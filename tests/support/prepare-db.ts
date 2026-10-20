import { execSync } from "node:child_process";

import pg from "pg";

/**
 * Crea la base de datos si no existe y aplica las migraciones.
 * Por seguridad solo opera sobre bases cuyo nombre termina en _test o _e2e:
 * un DATABASE_URL de producción mal configurado nunca se toca.
 */
export async function prepareDatabase(url: string, { seed = false } = {}) {
  const parsed = new URL(url);
  const dbName = parsed.pathname.slice(1);
  if (!/_(test|e2e)$/.test(dbName)) {
    throw new Error(`Base de datos "${dbName}" rechazada: debe terminar en _test o _e2e`);
  }

  const admin = new URL(url);
  admin.pathname = "/postgres";
  admin.search = "";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    // El nombre ya fue validado con la regex de arriba, así que es seguro interpolarlo.
    if (!rowCount) await client.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.end();
  }

  // DIRECT_URL también: prisma.config.ts la prioriza y no debe apuntar a otra base
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  if (seed) execSync("npx prisma db seed", { env, stdio: "pipe" });
}
