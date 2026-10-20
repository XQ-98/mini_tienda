import { beforeEach, describe, expect, it } from "vitest";

import type { OrderStatus } from "@/generated/prisma/client";
import type { ProductInput } from "@/lib/validations/admin";
import {
  AdminError,
  addProductImage,
  deleteCategory,
  deleteProduct,
  deleteProductImage,
  moveProductImage,
  saveCategory,
  saveProduct,
} from "@/server/admin/catalog-admin.service";
import { getDashboardData } from "@/server/admin/dashboard.service";
import { updateSettings, updateShippingRates } from "@/server/admin/settings-admin.service";
import { db } from "@/server/db";
import { confirmReviewedPayment, transitionOrder } from "@/server/orders/order.service";

import { createProduct, createUser, resetDb, seedStoreBasics } from "./helpers";

beforeEach(async () => {
  await resetDb();
  await seedStoreBasics();
});

/** Crea un pedido directamente en un estado dado (sin pasar por el carrito). */
async function orderIn(
  status: OrderStatus,
  items: { variantId: string; quantity: number }[],
  extra: { total?: number; paidAt?: Date | null } = {},
) {
  const user = await createUser();
  return db.order.create({
    data: {
      userId: user.id,
      status,
      paymentMethod: "BANK_TRANSFER",
      shipName: "Ana",
      shipPhone: "0991234567",
      shipProvince: "Imbabura",
      shipCity: "Otavalo",
      shipAddress: "Calle 1",
      billIdType: "CEDULA",
      billId: "1710034065",
      billName: "Ana",
      billEmail: "a@b.co",
      subtotal: 0,
      shippingCost: 0,
      taxRateBps: 1500,
      taxAmount: 0,
      total: extra.total ?? 1000,
      paidAt: extra.paidAt ?? (status === "PENDING_PAYMENT" || status === "CANCELLED" ? null : new Date()),
      items: {
        create: items.map((i) => ({
          variantId: i.variantId,
          productName: "P",
          variantLabel: "U",
          sku: "SKU",
          unitPrice: 500,
          quantity: i.quantity,
        })),
      },
    },
  });
}

const stockOf = async (id: string) => (await db.productVariant.findUniqueOrThrow({ where: { id } })).stock;

describe("cambios de estado del pedido (admin)", () => {
  it("PAGADO → ENVIADO exige guía y la registra en el historial", async () => {
    const { variantIds: [v] } = await createProduct();
    const admin = await createUser();
    const order = await orderIn("PAID", [{ variantId: v, quantity: 1 }]);

    expect(await transitionOrder(order.id, "SHIPPED", admin.id, {})).toMatchObject({ ok: false });
    expect(await transitionOrder(order.id, "SHIPPED", admin.id, { trackingCode: "SV-123" })).toEqual({ ok: true });

    const after = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { events: true } });
    expect(after).toMatchObject({ status: "SHIPPED", trackingCode: "SV-123" });
    expect(after.events[0]).toMatchObject({ from: "PAID", to: "SHIPPED", actorId: admin.id, note: "Guía: SV-123" });
  });

  it.each([
    ["PENDING_PAYMENT", "SHIPPED"],
    ["PENDING_PAYMENT", "DELIVERED"],
    ["SHIPPED", "CANCELLED"],
    ["DELIVERED", "CANCELLED"],
    ["CANCELLED", "PENDING_PAYMENT"],
  ] as const)("no permite %s → %s", async (from, to) => {
    const { variantIds: [v] } = await createProduct();
    const order = await orderIn(from, [{ variantId: v, quantity: 1 }]);
    const result = await transitionOrder(order.id, to, "admin", { trackingCode: "X-1" });
    expect(result.ok).toBe(false);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(from);
  });

  it("no se puede marcar como PAGADO a mano: solo aprobando un pago", async () => {
    const { variantIds: [v] } = await createProduct();
    const order = await orderIn("PENDING_PAYMENT", [{ variantId: v, quantity: 1 }]);
    expect(await transitionOrder(order.id, "PAID", "admin")).toMatchObject({ ok: false });
  });

  it("cancelar un pedido PAGADO devuelve las unidades al stock y avisa del reembolso", async () => {
    const { variantIds: [v] } = await createProduct({ variants: [{ stock: 3 }] });
    const order = await orderIn("PAID", [{ variantId: v, quantity: 2 }]);

    expect(await transitionOrder(order.id, "CANCELLED", "admin", { note: "Cliente desistió" })).toEqual({ ok: true });
    expect(await stockOf(v)).toBe(5);
    const event = await db.orderEvent.findFirstOrThrow({ where: { orderId: order.id } });
    expect(event.note).toMatch(/Cliente desistió.*reembolsar/);
  });

  it("cancelar un pedido sin pagar no toca el stock y rechaza el comprobante en revisión", async () => {
    const { variantIds: [v] } = await createProduct({ variants: [{ stock: 3 }] });
    const order = await orderIn("PENDING_PAYMENT", [{ variantId: v, quantity: 2 }]);
    await db.payment.create({ data: { orderId: order.id, method: "BANK_TRANSFER", status: "IN_REVIEW", amount: 1000 } });

    expect(await transitionOrder(order.id, "CANCELLED", "admin")).toEqual({ ok: true });
    expect(await stockOf(v)).toBe(3);
    expect((await db.payment.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("REJECTED");
  });

  it("dos admins cancelando a la vez: el stock se repone una sola vez", async () => {
    const { variantIds: [v] } = await createProduct({ variants: [{ stock: 0 }] });
    const order = await orderIn("PAID", [{ variantId: v, quantity: 2 }]);

    const results = await Promise.all([
      transitionOrder(order.id, "CANCELLED", "admin-a"),
      transitionOrder(order.id, "CANCELLED", "admin-b"),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await stockOf(v)).toBe(2);
  });

  it("pago aprobado sin stock: tras reponer, el admin confirma el pedido", async () => {
    const { variantIds: [v] } = await createProduct({ variants: [{ stock: 0 }] });
    const order = await orderIn("PENDING_PAYMENT", [{ variantId: v, quantity: 1 }]);
    await db.payment.create({ data: { orderId: order.id, method: "PAYPHONE", status: "APPROVED", amount: 1000 } });

    expect(await confirmReviewedPayment(order.id, "admin")).toBe("out_of_stock");
    await db.productVariant.update({ where: { id: v }, data: { stock: 4 } });
    expect(await confirmReviewedPayment(order.id, "admin")).toBe("confirmed");
    expect(await stockOf(v)).toBe(3);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
    expect(await confirmReviewedPayment(order.id, "admin")).toBe("not_applicable");
  });
});

describe("productos (admin)", () => {
  async function input(overrides: Partial<ProductInput> = {}): Promise<ProductInput> {
    const category = await db.category.upsert({
      where: { slug: "gorros" },
      create: { name: "Gorros", slug: "gorros" },
      update: {},
    });
    return {
      name: "Gorro",
      slug: "gorro",
      description: "Gorro tejido",
      categoryId: category.id,
      price: 1990,
      compareAtPrice: null,
      isActive: true,
      isFeatured: false,
      variants: [{ sku: "G-GRIS", size: "Única", color: "Gris", colorHex: "#888888", price: null, stock: 5, isActive: true }],
      ...overrides,
    };
  }

  it("crea y luego edita: actualiza, agrega y elimina variantes", async () => {
    const created = await saveProduct(await input());
    const [gris] = await db.productVariant.findMany({ where: { productId: created.id } });

    await saveProduct(
      await input({
        price: 2150,
        variants: [
          { ...gris, id: gris.id, stock: 9 }, // se actualiza
          { sku: "G-AZUL", size: "Única", color: "Azul", colorHex: "#0000FF", price: null, stock: 3, isActive: true }, // nueva
        ],
      }),
      created.id,
    );
    const variants = await db.productVariant.findMany({ where: { productId: created.id }, orderBy: { sku: "asc" } });
    expect(variants.map((v) => [v.sku, v.stock])).toEqual([["G-AZUL", 3], ["G-GRIS", 9]]);

    await saveProduct(await input({ variants: [{ sku: "G-ROJO", size: "Única", color: "Rojo", colorHex: null, price: null, stock: 1, isActive: true }] }), created.id);
    expect((await db.productVariant.findMany({ where: { productId: created.id } })).map((v) => v.sku)).toEqual(["G-ROJO"]);
    expect((await db.product.findUniqueOrThrow({ where: { id: created.id } })).price).toBe(1990);
  });

  it("no permite 'robar' una variante de otro producto enviando su id", async () => {
    const other = await createProduct({ variants: [{ stock: 7 }] });
    const mine = await saveProduct(await input());
    const stolen = { id: other.variantIds[0], sku: "ROBADA", size: "X", color: null, colorHex: null, price: null, stock: 999, isActive: true };

    await expect(saveProduct(await input({ variants: [stolen] }), mine.id)).rejects.toBeInstanceOf(AdminError);
    expect(await stockOf(other.variantIds[0])).toBe(7);
  });

  it("slug o SKU repetidos dan un error claro y no guardan nada", async () => {
    await saveProduct(await input());
    await expect(saveProduct(await input({ name: "Otro" }))).rejects.toThrow("Ya existe un producto con ese slug.");
    await expect(saveProduct(await input({ slug: "otro" }))).rejects.toThrow("SKU ya lo usa otro producto");
    expect(await db.product.count()).toBe(1);
  });

  it("eliminar devuelve las claves de las imágenes para borrarlas del almacenamiento", async () => {
    const { id } = await saveProduct(await input());
    await addProductImage(id, { url: "/media/a.jpg", storageId: "productos/x/a.jpg", alt: "a" });
    const result = await deleteProduct(id);
    expect(result).toEqual({ slug: "gorro", imageKeys: ["productos/x/a.jpg"] });
    expect(await db.productVariant.count()).toBe(0);
  });

  it("ordena imágenes: la primera es la portada", async () => {
    const { id } = await saveProduct(await input());
    const a = await addProductImage(id, { url: "/a", storageId: "p/a.jpg", alt: "a" });
    const b = await addProductImage(id, { url: "/b", storageId: "p/b.jpg", alt: "b" });
    expect([a.position, b.position]).toEqual([0, 1]);

    await moveProductImage(b.id, "up");
    const order = await db.productImage.findMany({ where: { productId: id }, orderBy: { position: "asc" } });
    expect(order.map((i) => i.url)).toEqual(["/b", "/a"]);
    expect((await deleteProductImage(a.id)).storageId).toBe("p/a.jpg");
  });
});

describe("categorías (admin)", () => {
  it("no elimina una categoría con productos; una vacía sí, devolviendo su imagen", async () => {
    await createProduct(); // crea su propia categoría con un producto
    const withProducts = await db.category.findFirstOrThrow();
    await expect(deleteCategory(withProducts.id)).rejects.toBeInstanceOf(AdminError);

    const { id } = await saveCategory(
      { name: "Vacía", slug: "vacia", description: null, sortOrder: 9, isActive: true },
      undefined,
      { url: "/media/c.jpg", key: "categorias/c.jpg" },
    );
    expect(await deleteCategory(id)).toBe("categorias/c.jpg");
  });

  it("al reemplazar la imagen devuelve la anterior para borrarla", async () => {
    const data = { name: "Gorros", slug: "gorros", description: null, sortOrder: 0, isActive: true };
    const { id } = await saveCategory(data, undefined, { url: "/media/1.jpg", key: "categorias/1.jpg" });
    const updated = await saveCategory(data, id, { url: "/media/2.jpg", key: "categorias/2.jpg" });
    expect(updated.replacedImageKey).toBe("categorias/1.jpg");
  });
});

describe("dashboard", () => {
  // 20 oct 2026, 10:00 en Ecuador
  const NOW = new Date("2026-10-20T15:00:00Z");

  it("ventas de hoy y del mes en hora de Ecuador; cancelados y sin pagar no cuentan", async () => {
    const { variantIds: [v] } = await createProduct();
    const item = [{ variantId: v, quantity: 1 }];
    await orderIn("PAID", item, { total: 1000, paidAt: new Date("2026-10-20T06:00:00Z") }); // hoy 01:00 EC
    await orderIn("DELIVERED", item, { total: 2000, paidAt: new Date("2026-10-20T04:59:00Z") }); // ayer 23:59 EC
    await orderIn("SHIPPED", item, { total: 4000, paidAt: new Date("2026-10-01T05:00:00Z") }); // 1 oct 00:00 EC
    await orderIn("PAID", item, { total: 8000, paidAt: new Date("2026-10-01T04:59:00Z") }); // 30 sept 23:59 EC
    await orderIn("CANCELLED", item, { total: 16_000, paidAt: new Date("2026-10-20T10:00:00Z") });
    await orderIn("PENDING_PAYMENT", item, { total: 32_000 });

    const d = await getDashboardData(NOW, 5);
    expect(d.salesToday).toEqual({ total: 1000, orders: 1 });
    expect(d.salesMonth).toEqual({ total: 7000, orders: 3 });
    expect(d.pendingPayment).toBe(1);
    expect(d.toShip).toBe(2);
    expect(d.daily).toHaveLength(30);
    expect(d.daily.find((x) => x.date === "2026-10-19")?.total).toBe(2000);
    expect(d.daily.at(-1)).toEqual({ date: "2026-10-20", total: 1000 });
  });

  it("lista variantes con poco stock (activas y de productos visibles)", async () => {
    await createProduct({ variants: [{ stock: 0 }, { stock: 3 }, { stock: 50 }, { stock: 1, isActive: false }] });
    await createProduct({ isActive: false, variants: [{ stock: 0 }] });
    const d = await getDashboardData(NOW, 5);
    expect(d.lowStock.map((v) => v.stock)).toEqual([0, 3]);
    expect(d.lowStockCount).toBe(2);
  });
});

describe("configuración (admin)", () => {
  it("guarda IVA en puntos básicos y tarifas de envío por provincia", async () => {
    await updateSettings({
      storeName: "Nueva",
      tagline: null,
      whatsappNumber: "593991234567",
      contactEmail: "a@b.co",
      address: null,
      taxRatePercent: 1200,
      lowStockThreshold: 3,
      freeShippingFrom: null,
    });
    expect(await db.storeSettings.findUniqueOrThrow({ where: { id: 1 } })).toMatchObject({
      storeName: "Nueva",
      taxRateBps: 1200,
      freeShippingFrom: null,
    });

    await updateShippingRates([
      { provinceCode: "20", cost: 2000, estimatedDays: "7 días" },
      { provinceCode: "01", cost: 600, estimatedDays: "2 días" }, // no existía: se crea
    ]);
    expect(await db.shippingRate.findUniqueOrThrow({ where: { provinceCode: "20" } })).toMatchObject({ cost: 2000 });
    expect(await db.shippingRate.findUniqueOrThrow({ where: { provinceCode: "01" } })).toMatchObject({ provinceName: "Azuay" });
  });
});
