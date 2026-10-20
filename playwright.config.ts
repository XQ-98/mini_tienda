import { defineConfig, devices } from "@playwright/test";

import { E2E_BASE_URL, E2E_DATABASE_URL, E2E_PORT } from "./tests/support/test-db";

// Los E2E corren contra un build de producción (next build + next start) y una
// base de datos propia (tienda_e2e), sembrada por tests/e2e/setup-db.ts.
// Se usa un celular como dispositivo: la mayoría de clientes compra desde ahí.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  use: {
    baseURL: E2E_BASE_URL,
    locale: "es-EC",
    trace: "retain-on-failure",
  },
  projects: [{ name: "celular", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npm run build && npm run start -- --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      NEXT_PUBLIC_SITE_URL: E2E_BASE_URL,
      AUTH_SECRET: "e2e-secret-solo-para-pruebas-no-usar-en-produccion",
      AUTH_TRUST_HOST: "true",
      PAYPHONE_MODE: "mock",
      // Comprobantes de E2E en su propia carpeta (no se mezclan con los de desarrollo)
      PRIVATE_UPLOADS_DIR: "uploads/e2e/private",
      PUBLIC_UPLOADS_DIR: "uploads/e2e/public",
    },
  },
});
