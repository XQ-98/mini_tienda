import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Las migraciones usan la conexión directa si existe (en Neon, la URL sin
    // "-pooler"); la app en runtime usa DATABASE_URL (con pooler).
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
