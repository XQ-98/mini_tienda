import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { consumeRateLimit, isRateLimited, resetRateLimit } from "@/server/security/rate-limit";

import { resetDb } from "./helpers";

beforeEach(resetDb);

const policy = { limit: 3, windowMs: 60_000 };

describe("rate limiting", () => {
  it("permite hasta el límite y luego bloquea", async () => {
    const results = [];
    for (let i = 0; i < 5; i++) results.push((await consumeRateLimit("k", policy)).allowed);
    expect(results).toEqual([true, true, true, false, false]);
    expect(await isRateLimited("k", policy.limit)).toBe(true);
  });

  it("se reinicia cuando vence la ventana", async () => {
    const short = { limit: 1, windowMs: 300 };
    expect((await consumeRateLimit("k", short)).allowed).toBe(true);
    expect((await consumeRateLimit("k", short)).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 400));
    expect((await consumeRateLimit("k", short)).allowed).toBe(true);
  });

  it("las claves son independientes y se pueden reiniciar", async () => {
    for (let i = 0; i < 3; i++) await consumeRateLimit("a", policy);
    expect(await isRateLimited("a", 3)).toBe(true);
    expect(await isRateLimited("b", 3)).toBe(false);
    await resetRateLimit("a");
    expect(await isRateLimited("a", 3)).toBe(false);
  });

  it("es atómico: 50 peticiones simultáneas cuentan exactamente 50", async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, () => consumeRateLimit("burst", { limit: 10, windowMs: 60_000 })),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    expect((await db.rateLimit.findUnique({ where: { key: "burst" } }))?.count).toBe(50);
  });

  it("la clave se guarda como dato, no como SQL (consulta parametrizada)", async () => {
    const malicious = `x'); DROP TABLE "RateLimit"; --`;
    await consumeRateLimit(malicious, policy);
    expect(await db.rateLimit.findUnique({ where: { key: malicious } })).not.toBeNull();
    expect(await db.rateLimit.count()).toBe(1); // la tabla sigue existiendo
  });
});
