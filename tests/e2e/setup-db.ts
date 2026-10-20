// Prepara la base de datos de E2E antes de cada corrida: crea tienda_e2e si no
// existe, aplica migraciones y vuelve a sembrar los datos (estado conocido).
import { prepareDatabase } from "../support/prepare-db";
import { E2E_DATABASE_URL } from "../support/test-db";

prepareDatabase(E2E_DATABASE_URL, { seed: true })
  .then(() => console.log("Base de datos E2E lista (tienda_e2e)"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
