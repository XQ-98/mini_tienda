import { db } from "@/server/db";

/** Vacía todas las tablas. Se niega a correr si la base no es de pruebas. */
export async function resetDb() {
  const [{ current_database: name }] = await db.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
  if (!name.endsWith("_test")) throw new Error(`resetDb() se negó a vaciar "${name}"`);

  await db.$executeRaw`TRUNCATE TABLE
    "RateLimit", "OrderEvent", "Payment", "OrderItem", "Order", "CartItem", "Cart",
    "ProductImage", "ProductVariant", "Product", "Category", "User",
    "ShippingRate", "BankAccount", "StoreSettings"
    RESTART IDENTITY CASCADE`;
}

let counter = 0;
const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

interface VariantInput {
  stock: number;
  price?: number | null;
  isActive?: boolean;
  size?: string;
  color?: string;
}

/** Crea un producto con sus variantes y devuelve los IDs. */
export async function createProduct({
  price = 2000,
  isActive = true,
  variants = [{ stock: 10 }],
}: { price?: number; isActive?: boolean; variants?: VariantInput[] } = {}) {
  const id = uid();
  const category = await db.category.create({ data: { name: `Cat ${id}`, slug: `cat-${id}` } });
  const product = await db.product.create({
    data: {
      name: `Producto ${id}`,
      slug: `producto-${id}`,
      description: "Producto de prueba",
      price,
      isActive,
      categoryId: category.id,
      images: { create: [{ url: "/x.svg", alt: "x" }] },
      variants: {
        create: variants.map((v, i) => ({
          sku: `SKU-${id}-${i}`,
          size: v.size ?? `T${i}`,
          color: v.color ?? "Negro",
          stock: v.stock,
          price: v.price ?? null,
          isActive: v.isActive ?? true,
        })),
      },
    },
    include: { variants: { orderBy: { sku: "asc" } } },
  });
  return { productId: product.id, variantIds: product.variants.map((v) => v.id) };
}

export async function createUser(email = `u-${uid()}@test.ec`) {
  return db.user.create({ data: { name: "Usuario Prueba", email, passwordHash: "x" } });
}

/** Configuración mínima de la tienda: IVA 15 %, envío gratis desde $100 y tres provincias. */
export async function seedStoreBasics() {
  await db.storeSettings.create({
    data: { id: 1, storeName: "Test", whatsappNumber: "593900000000", contactEmail: "t@t.ec", freeShippingFrom: 10_000 },
  });
  await db.shippingRate.createMany({
    data: [
      { provinceCode: "10", provinceName: "Imbabura", cost: 300, estimatedDays: "1 día" },
      { provinceCode: "17", provinceName: "Pichincha", cost: 400, estimatedDays: "1-2 días" },
      { provinceCode: "20", provinceName: "Galápagos", cost: 1500, estimatedDays: "5-8 días" },
    ],
  });
}
