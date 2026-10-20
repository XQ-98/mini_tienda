import { beforeEach, describe, expect, it } from "vitest";

import { verifyCredentials } from "@/server/auth/credentials";
import { registerUser } from "@/server/auth/register";
import { db } from "@/server/db";
import { LIMITS } from "@/server/security/rate-limit";

import { resetDb } from "./helpers";

beforeEach(resetDb);

const PASSWORD = "Clave-segura1";
const IP = "190.152.10.4";

async function register(email = "ana@example.com", extra: Record<string, unknown> = {}) {
  const result = await registerUser({
    name: "Ana Pérez",
    email,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    ...extra,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.fieldErrors));
  return result;
}

describe("registro", () => {
  it("guarda la contraseña con bcrypt (costo 12), nunca en texto plano", async () => {
    await register();
    const user = await db.user.findUniqueOrThrow({ where: { email: "ana@example.com" } });
    expect(user.passwordHash).not.toContain(PASSWORD);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/);
  });

  it("el rol siempre es CUSTOMER aunque se envíe role=ADMIN", async () => {
    await register("ana@example.com", { role: "ADMIN" });
    const user = await db.user.findUniqueOrThrow({ where: { email: "ana@example.com" } });
    expect(user.role).toBe("CUSTOMER");
  });

  it("no permite duplicar un correo, aunque cambien mayúsculas", async () => {
    await register("ana@example.com");
    const dup = await registerUser({
      name: "Otra Ana",
      email: "ANA@Example.com",
      password: PASSWORD,
      confirmPassword: PASSWORD,
    });
    expect(dup.ok).toBe(false);
  });
});

describe("inicio de sesión", () => {
  it("con credenciales correctas devuelve el usuario SIN el hash", async () => {
    await register();
    const result = await verifyCredentials({ email: "ANA@example.com", password: PASSWORD }, IP);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.user).sort()).toEqual(["email", "id", "name", "role"]);
    }
  });

  it("da el mismo error si el correo no existe o si la contraseña es incorrecta", async () => {
    await register();
    const wrongPassword = await verifyCredentials({ email: "ana@example.com", password: "otra-clave1" }, IP);
    const unknownEmail = await verifyCredentials({ email: "nadie@example.com", password: PASSWORD }, IP);
    expect(wrongPassword).toEqual({ ok: false, reason: "invalid_credentials" });
    expect(unknownEmail).toEqual(wrongPassword);
  });

  it("tarda lo mismo exista o no el correo (evita enumerar usuarios por tiempo)", async () => {
    await register();
    const time = async (email: string) => {
      const start = performance.now();
      await verifyCredentials({ email, password: "otra-clave1" }, IP);
      return performance.now() - start;
    };
    await time("calentamiento@example.com"); // genera el hash ficticio
    const existing = await time("ana@example.com");
    const missing = await time("nadie@example.com");
    // Ambos ejecutan bcrypt; sin el hash ficticio el correo inexistente respondería en ~1 ms
    expect(missing).toBeGreaterThan(existing * 0.5);
  });

  it(`bloquea la cuenta tras ${LIMITS.loginPerEmail.limit} intentos fallidos, incluso con la clave correcta`, async () => {
    await register();
    for (let i = 0; i < LIMITS.loginPerEmail.limit; i++) {
      await verifyCredentials({ email: "ana@example.com", password: `incorrecta${i}` }, IP);
    }
    const result = await verifyCredentials({ email: "ana@example.com", password: PASSWORD }, IP);
    expect(result).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("un inicio de sesión correcto reinicia el contador de fallos", async () => {
    await register();
    for (let i = 0; i < LIMITS.loginPerEmail.limit - 1; i++) {
      await verifyCredentials({ email: "ana@example.com", password: "incorrecta1" }, IP);
    }
    expect((await verifyCredentials({ email: "ana@example.com", password: PASSWORD }, IP)).ok).toBe(true);
    expect(await db.rateLimit.findUnique({ where: { key: "login:email:ana@example.com" } })).toBeNull();
  });

  it("limita intentos por IP (credential stuffing contra muchos correos)", async () => {
    await register();
    await db.rateLimit.create({
      data: { key: `login:ip:${IP}`, count: LIMITS.loginPerIp.limit, resetAt: new Date(Date.now() + 60_000) },
    });
    const result = await verifyCredentials({ email: "ana@example.com", password: PASSWORD }, IP);
    expect(result).toEqual({ ok: false, reason: "rate_limited" });
    // Otra IP no está afectada
    expect((await verifyCredentials({ email: "ana@example.com", password: PASSWORD }, "200.1.2.3")).ok).toBe(true);
  });

  it.each([
    { email: "' OR '1'='1", password: "x" },
    { email: { $ne: null }, password: { $ne: null } },
    { email: "ana@example.com" },
    null,
    "texto",
  ])("rechaza credenciales malformadas %j sin consultar usuarios", async (raw) => {
    expect(await verifyCredentials(raw, IP)).toEqual({ ok: false, reason: "invalid_credentials" });
  });
});
