// Bases de datos de prueba: separadas de la de desarrollo para que los tests
// puedan borrar datos sin riesgo. Se pueden sobrescribir por variable de entorno.

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://tienda:tienda@localhost:5433/tienda_test?schema=public";

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://tienda:tienda@localhost:5433/tienda_e2e?schema=public";

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
