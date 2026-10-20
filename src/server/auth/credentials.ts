import "server-only";

import type { Role } from "@/generated/prisma/enums";
import { loginSchema } from "@/lib/validations/auth";
import { db } from "@/server/db";
import { getDummyHash, verifyPassword } from "@/server/security/password";
import {
  LIMITS,
  consumeRateLimit,
  isRateLimited,
  resetRateLimit,
} from "@/server/security/rate-limit";

export type CredentialsResult =
  | { ok: true; user: { id: string; name: string; email: string; role: Role } }
  | { ok: false; reason: "invalid_credentials" | "rate_limited" };

/**
 * Verifica email y contraseña con las protecciones de seguridad:
 * - límite de intentos por IP y por correo (fuerza bruta / credential stuffing)
 * - mismo error y tiempo de respuesta exista o no el correo (enumeración de usuarios)
 * - nunca devuelve el hash de la contraseña
 *
 * Separado de la configuración de Auth.js para poder testearlo directamente.
 */
export async function verifyCredentials(raw: unknown, ip: string): Promise<CredentialsResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid_credentials" };
  const { email, password } = parsed.data;

  const ipLimit = await consumeRateLimit(`login:ip:${ip}`, LIMITS.loginPerIp);
  if (!ipLimit.allowed) return { ok: false, reason: "rate_limited" };

  const emailKey = `login:email:${email}`;
  if (await isRateLimited(emailKey, LIMITS.loginPerEmail.limit)) {
    return { ok: false, reason: "rate_limited" };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, passwordHash: true },
  });
  const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

  if (!user || !valid) {
    await consumeRateLimit(emailKey, LIMITS.loginPerEmail);
    return { ok: false, reason: "invalid_credentials" };
  }

  await resetRateLimit(emailKey);
  return { ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}
