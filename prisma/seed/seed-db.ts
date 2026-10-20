// Carga los datos de ejemplo en la base. No escribe archivos: lo usan el
// comando `npm run db:seed` y el reinicio nocturno de la demo (en Vercel el
// disco es de solo lectura). Las imágenes SVG se generan aparte (images.ts).

import type { PrismaClient } from "../../src/generated/prisma/client";
import { PROVINCES, type Region } from "../../src/lib/data/ecuador";
import { hashPassword } from "../../src/server/security/password";
import { CATEGORIES, PRODUCTS } from "./data";

export const categoryImagePath = (slug: string) => `/images/categories/${slug}.svg`;
export const productImagePath = (slug: string, n: number | "detalle") => `/images/products/${slug}-${n}.svg`;

// Generador pseudoaleatorio con semilla: el stock sale igual en cada ejecución.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

function code(text: string) {
  const words = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/s+/);
  return words[0].slice(0, 3) + (words[1]?.[0] ?? "");
}

const SHIPPING_BY_REGION: Record<Region, { cost: number; days: string }> = {
  Sierra: { cost: 500, days: "2-3 días hábiles" },
  Costa: { cost: 550, days: "2-3 días hábiles" },
  Amazonía: { cost: 650, days: "3-5 días hábiles" },
  Insular: { cost: 1500, days: "5-8 días hábiles" },
};

// La tienda despacha desde Otavalo: Imbabura y provincias vecinas son más baratas.
const SHIPPING_OVERRIDES: Record<string, { cost: number; days: string }> = {
  "10": { cost: 300, days: "1 día hábil" }, // Imbabura
  "17": { cost: 400, days: "1-2 días hábiles" }, // Pichincha
  "04": { cost: 400, days: "1-2 días hábiles" }, // Carchi
};

async function clean(db: PrismaClient) {
  // Orden inverso a las dependencias
  await db.rateLimit.deleteMany();
  await db.orderEvent.deleteMany();
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  // Vuelve a numerar desde #1001 (START WITH de la migración)
  await db.$executeRaw`ALTER SEQUENCE "Order_number_seq" RESTART`;
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.productImage.deleteMany();
  await db.productVariant.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();
  await db.user.deleteMany();
  await db.shippingRate.deleteMany();
  await db.bankAccount.deleteMany();
  await db.storeSettings.deleteMany();
}

export async function seedDatabase(db: PrismaClient, log: (msg: string) => void = () => {}) {
  log("🧹 Limpiando datos…");
  await clean(db);

  log("⚙️  Configuración de la tienda…");
  await db.storeSettings.create({
    data: {
      id: 1,
      storeName: "Telar Andino",
      tagline: "Ropa y accesorios tejidos a mano en Otavalo",
      whatsappNumber: "593991234567",
      contactEmail: "hola@telarandino.ec",
      address: "Calle Sucre y Calderón, Otavalo, Imbabura",
      taxRateBps: 1500,
      lowStockThreshold: 5,
      freeShippingFrom: 10000, // envío gratis desde $100
    },
  });

  await db.shippingRate.createMany({
    data: PROVINCES.map((p) => {
      const rate = SHIPPING_OVERRIDES[p.code] ?? SHIPPING_BY_REGION[p.region];
      return {
        provinceCode: p.code,
        provinceName: p.name,
        cost: rate.cost,
        estimatedDays: rate.days,
      };
    }),
  });

  await db.bankAccount.createMany({
    data: [
      {
        bankName: "Banco Pichincha",
        accountType: "Ahorros",
        accountNumber: "2200000001",
        holderName: "Telar Andino S.A.S.",
        holderId: "1091234560001",
        sortOrder: 0,
      },
      {
        bankName: "Banco Guayaquil",
        accountType: "Corriente",
        accountNumber: "0000000002",
        holderName: "Telar Andino S.A.S.",
        holderId: "1091234560001",
        sortOrder: 1,
      },
    ],
  });

  log("👤 Usuarios de prueba…");
  await db.user.create({
    data: {
      name: "Administrador",
      email: "admin@telarandino.ec",
      passwordHash: await hashPassword("Admin123!"),
      role: "ADMIN",
    },
  });
  await db.user.create({
    data: {
      name: "María Guamán",
      email: "cliente@ejemplo.com",
      passwordHash: await hashPassword("Cliente123!"),
      phone: "0991234567",
    },
  });

  log("🏷️  Categorías…");
  const categoryIds = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const imageUrl = categoryImagePath(c.slug);
    const created = await db.category.create({
      data: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl,
        sortOrder: i,
      },
    });
    categoryIds.set(c.slug, created.id);
  }

  log("👕 Productos, variantes e imágenes…");
  const random = rng(42);
  for (const [i, p] of PRODUCTS.entries()) {
    // Una imagen por color; si hay un solo color, se agrega una vista de detalle.
    const images = p.colors.map((color, n) => ({
      url: productImagePath(p.slug, n + 1),
      alt: `${p.name} en color ${color.name.toLowerCase()}`,
      color: color.name as string | null,
      position: n,
    }));
    if (p.colors.length === 1) {
      images.push({
        url: productImagePath(p.slug, "detalle"),
        alt: `Detalle del tejido de ${p.name.toLowerCase()}`,
        color: null,
        position: 1,
      });
    }

    const variants = p.sizes.flatMap((size) =>
      p.colors.map((color) => {
        // ~10 % agotado, ~15 % con poco stock, el resto entre 6 y 25 unidades
        const r = random();
        const stock = r < 0.1 ? 0 : r < 0.25 ? 1 + Math.floor(random() * 4) : 6 + Math.floor(random() * 20);
        return {
          sku: `TA-${String(i + 1).padStart(3, "0")}-${code(size === "Única" ? "U" : size)}-${code(color.name)}`,
          size,
          color: color.name,
          colorHex: color.hex,
          stock,
        };
      }),
    );

    await db.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: Math.round(p.price * 100),
        compareAtPrice: p.compareAt ? Math.round(p.compareAt * 100) : null,
        isFeatured: p.featured ?? false,
        categoryId: categoryIds.get(p.category)!,
        images: { create: images },
        variants: { create: variants },
      },
    });
  }


  const [products, variants] = await Promise.all([db.product.count(), db.productVariant.count()]);
  return { products, variants };
}
