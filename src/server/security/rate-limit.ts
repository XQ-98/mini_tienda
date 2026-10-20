import "server-only";

import { db } from "@/server/db";

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  resetAt: Date;
}

/**
 * Registra un intento y dice si está permitido (ventana fija).
 * Es una sola sentencia SQL atómica (INSERT … ON CONFLICT), así que 50
 * peticiones simultáneas cuentan 50, sin condiciones de carrera.
 * La consulta es parametrizada: `key` nunca se concatena al SQL.
 */
export async function consumeRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  const [row] = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;

  return { allowed: row.count <= limit, count: row.count, resetAt: row.resetAt };
}

/** ¿La clave ya alcanzó el límite? No registra un intento nuevo. */
export async function isRateLimited(key: string, limit: number): Promise<boolean> {
  const row = await db.rateLimit.findUnique({ where: { key } });
  return !!row && row.resetAt > new Date() && row.count >= limit;
}

export async function resetRateLimit(key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}

// Políticas usadas en la app
export const LIMITS = {
  /** Intentos fallidos por cuenta: frena ataques de fuerza bruta a un correo. */
  loginPerEmail: { limit: 5, windowMs: 15 * 60_000 },
  /** Intentos totales por IP: frena el "credential stuffing" contra muchos correos. */
  loginPerIp: { limit: 30, windowMs: 15 * 60_000 },
  /** Registros por IP: evita la creación masiva de cuentas. */
  registerPerIp: { limit: 5, windowMs: 60 * 60_000 },
  /** Pedidos por usuario: evita que un script cree pedidos en masa. */
  checkoutPerUser: { limit: 10, windowMs: 10 * 60_000 },
  /** Subida de comprobantes por usuario. */
  uploadPerUser: { limit: 10, windowMs: 60 * 60_000 },
  /** Intentos de pago con tarjeta por usuario. */
  paymentPerUser: { limit: 10, windowMs: 10 * 60_000 },
} as const;
