import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Debe coincidir con tests/support/test-db.ts
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://tienda:tienda@localhost:5433/tienda_test?schema=public";

export default defineConfig({
  resolve: {
    alias: {
      "@": r("./src"),
      "server-only": r("./tests/support/server-only.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          env: {
            DATABASE_URL: TEST_DATABASE_URL,
            AUTH_SECRET: "secreto-solo-para-tests",
            PAYPHONE_MODE: "mock",
          },
          // Comparten una base de datos: un archivo a la vez.
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
