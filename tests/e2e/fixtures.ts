import { test as base } from "@playwright/test";
import pg from "pg";

import { E2E_DATABASE_URL } from "../support/test-db";

// Cada test simula un cliente distinto con su propia IP. Así los límites por IP
// (login, registro) se comportan como en producción, donde cada persona tiene
// su IP, sin tener que relajar la seguridad para la suite de pruebas.
export const randomIp = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`;

export const test = base.extend({
  context: async ({ context }, provide) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
    await provide(context);
  },
});

export { expect } from "@playwright/test";

/** Consulta directa a la base de E2E: verificar efectos (stock) o preparar casos (cambiar un rol). */
export async function queryDb<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

export async function variantStock(slug: string, size: string, color: string): Promise<number> {
  const [row] = await queryDb<{ stock: number }>(
    `SELECT v.stock FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
     WHERE p.slug = $1 AND v.size = $2 AND v.color = $3`,
    [slug, size, color],
  );
  return row.stock;
}
