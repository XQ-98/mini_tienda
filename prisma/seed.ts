import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { writePlaceholderImages } from "./seed/images";
import { seedDatabase } from "./seed/seed-db";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  writePlaceholderImages();
  const { products, variants } = await seedDatabase(db, console.log);
  console.log(`✅ Listo: ${products} productos, ${variants} variantes.`);
  console.log("   Admin:   admin@telarandino.ec / Admin123!");
  console.log("   Cliente: cliente@ejemplo.com / Cliente123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
