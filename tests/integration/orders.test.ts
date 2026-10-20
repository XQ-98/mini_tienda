import { beforeEach, describe, expect, it } from "vitest";

import type { BillingData, CheckoutData } from "@/lib/validations/checkout";
import { CONSUMIDOR_FINAL_ID } from "@/lib/domain/ec-id";
import { addItem, getOrCreateUserCart } from "@/server/cart/cart.service";
import { db } from "@/server/db";
import {
  approveTransfer,
  cancelOrderByCustomer,
  changePaymentMethod,
  CheckoutError,
  confirmOrderPayment,
  createOrderFromCart,
  rejectTransfer,
  submitTransferProof,
} from "@/server/orders/order.service";

import { createProduct, createUser, resetDb, seedStoreBasics } from "./helpers";

beforeEach(async () => {
  await resetDb();
  await seedStoreBasics();
});

const SHIPPING: Omit<CheckoutData, "paymentMethod"> = {
  shipName: "María Guamán",
  shipPhone: "0991234567",
  shipProvince: "10",
  shipCity: "Otavalo",
  shipAddress: "Calle Bolívar 5-12",
  shipReference: undefined,
  billingType: "consumidor_final",
  billId: undefined,
  billName: undefined,
  billEmail: undefined,
};
const CF: BillingData = { idType: "CONSUMIDOR_FINAL", id: CONSUMIDOR_FINAL_ID, name: "CONSUMIDOR FINAL", email: "a@b.co" };
const CEDULA: BillingData = { idType: "CEDULA", id: "1710034065", name: "María Guamán", email: "a@b.co" };

/** Crea un usuario con carrito y un pedido a partir de él. */
async function placeOrder(opts: {
  items: { variantId: string; quantity: number }[];
  method?: "PAYPHONE" | "BANK_TRANSFER";
  province?: string;
  billing?: BillingData;
  userId?: string;
}) {
  const userId = opts.userId ?? (await createUser()).id;
  const cartId = await getOrCreateUserCart(userId);
  for (const i of opts.items) await addItem(cartId, i.variantId, i.quantity);
  const order = await createOrderFromCart({
    userId,
    cartId,
    data: {
      ...SHIPPING,
      shipProvince: opts.province ?? "10",
      shipCity: opts.province === "17" ? "Quito" : "Otavalo",
      paymentMethod: opts.method ?? "BANK_TRANSFER",
    },
    billing: opts.billing ?? CEDULA,
  });
  return { ...order, userId, cartId };
}

const stockOf = async (variantId: string) =>
  (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;
const transferPayment = (orderId: string) =>
  db.payment.findFirstOrThrow({ where: { orderId, method: "BANK_TRANSFER" }, orderBy: { createdAt: "desc" } });

describe("crear pedido desde el carrito", () => {
  it("guarda una copia de precios y calcula envío e IVA en el servidor", async () => {
    const { variantIds: [v] } = await createProduct({ price: 2400, variants: [{ stock: 5 }] });
    const { orderId, userId, cartId } = await placeOrder({ items: [{ variantId: v, quantity: 2 }] });

    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, events: true } });
    // 2 × 24 + 3 (Imbabura) = 51 → base 44.35, IVA 6.65
    expect(order).toMatchObject({
      userId,
      status: "PENDING_PAYMENT",
      shipProvince: "Imbabura",
      shippingCost: 300,
      total: 5100,
      subtotal: 4435,
      taxAmount: 665,
      taxRateBps: 1500,
    });
    expect(order.items[0]).toMatchObject({ unitPrice: 2400, quantity: 2 });
    expect(order.events).toHaveLength(1);
    expect(await db.cartItem.count({ where: { cartId } })).toBe(0); // carrito vacío
    expect(await stockOf(v)).toBe(5); // el stock se descuenta al pagar, no al pedir
  });

  it("el número de pedido empieza en 1001", async () => {
    const { variantIds: [v] } = await createProduct();
    const { number } = await placeOrder({ items: [{ variantId: v, quantity: 1 }] });
    expect(number).toBeGreaterThanOrEqual(1001);
  });

  it("envío gratis desde $100", async () => {
    const { variantIds: [v] } = await createProduct({ price: 5000, variants: [{ stock: 5 }] });
    const { orderId } = await placeOrder({ items: [{ variantId: v, quantity: 2 }], province: "17", billing: CEDULA });
    expect(await db.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ shippingCost: 0, total: 10_000 });
  });

  it("si el precio cambió, el pedido usa el precio vigente; después el pedido ya no cambia", async () => {
    const { productId, variantIds: [v] } = await createProduct({ price: 2000 });
    const userId = (await createUser()).id;
    const cartId = await getOrCreateUserCart(userId);
    await addItem(cartId, v, 1);
    await db.product.update({ where: { id: productId }, data: { price: 2500 } });

    const { orderId } = await createOrderFromCart({ userId, cartId, data: { ...SHIPPING, paymentMethod: "BANK_TRANSFER" }, billing: CF });
    await db.product.update({ where: { id: productId }, data: { price: 9999 } });

    const item = await db.orderItem.findFirstOrThrow({ where: { orderId } });
    expect(item.unitPrice).toBe(2500);
  });

  it("transferencia crea un pago pendiente; tarjeta no (cada intento crea el suyo)", async () => {
    const { variantIds: [v] } = await createProduct();
    const t = await placeOrder({ items: [{ variantId: v, quantity: 1 }], method: "BANK_TRANSFER" });
    const c = await placeOrder({ items: [{ variantId: v, quantity: 1 }], method: "PAYPHONE" });
    expect(await db.payment.count({ where: { orderId: t.orderId, status: "PENDING" } })).toBe(1);
    expect(await db.payment.count({ where: { orderId: c.orderId } })).toBe(0);
  });

  it.each([
    ["carrito vacío", "empty_cart"],
    ["producto desactivado", "unavailable"],
    ["stock menor a la cantidad", "stock_changed"],
  ])("rechaza el pedido con %s", async (_case, code) => {
    const { productId, variantIds: [v] } = await createProduct({ variants: [{ stock: 5 }] });
    const userId = (await createUser()).id;
    const cartId = await getOrCreateUserCart(userId);
    if (code !== "empty_cart") await addItem(cartId, v, 3);
    if (code === "unavailable") await db.product.update({ where: { id: productId }, data: { isActive: false } });
    if (code === "stock_changed") await db.productVariant.update({ where: { id: v }, data: { stock: 2 } });

    const attempt = createOrderFromCart({ userId, cartId, data: { ...SHIPPING, paymentMethod: "PAYPHONE" }, billing: CF });
    await expect(attempt).rejects.toBeInstanceOf(CheckoutError);
    await expect(attempt).rejects.toMatchObject({ code });
    expect(await db.order.count()).toBe(0);
  });

  it("exige cédula o RUC en compras mayores a $50 (norma del SRI)", async () => {
    const { variantIds: [v] } = await createProduct({ price: 4900, variants: [{ stock: 5 }] });
    // 49 + 3 de envío = 52 > 50
    await expect(placeOrder({ items: [{ variantId: v, quantity: 1 }], billing: CF })).rejects.toMatchObject({
      code: "consumidor_final",
    });
    await expect(placeOrder({ items: [{ variantId: v, quantity: 1 }], billing: CEDULA })).resolves.toBeDefined();
  });
});

describe("confirmar pago y descontar stock", () => {
  it("descuenta el stock, marca PAGADO y registra el evento", async () => {
    const { variantIds: [a, b] } = await createProduct({ variants: [{ stock: 5 }, { stock: 3 }] });
    const { orderId } = await placeOrder({ items: [{ variantId: a, quantity: 2 }, { variantId: b, quantity: 1 }] });
    const payment = await transferPayment(orderId);

    expect(await confirmOrderPayment(payment.id, { note: "ok" })).toBe("confirmed");
    expect([await stockOf(a), await stockOf(b)]).toEqual([3, 2]);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { events: true } });
    expect(order.status).toBe("PAID");
    expect(order.paidAt).not.toBeNull();
    expect(order.events.map((e) => e.to)).toEqual(["PENDING_PAYMENT", "PAID"]);
  });

  it("es idempotente: confirmar dos veces descuenta el stock una sola vez", async () => {
    const { variantIds: [v] } = await createProduct({ variants: [{ stock: 5 }] });
    const { orderId } = await placeOrder({ items: [{ variantId: v, quantity: 2 }] });
    const payment = await transferPayment(orderId);

    const results = await Promise.all([
      confirmOrderPayment(payment.id, { note: "1" }),
      confirmOrderPayment(payment.id, { note: "2" }),
      confirmOrderPayment(payment.id, { note: "3" }),
    ]);
    expect(results.filter((r) => r === "confirmed")).toHaveLength(1);
    expect(await stockOf(v)).toBe(3);
  });

  it("dos compras simultáneas de la última unidad: solo una se confirma y el stock nunca queda negativo", async () => {
    const { variantIds: [v] } = await createProduct({ variants: [{ stock: 1 }] });
    const first = await placeOrder({ items: [{ variantId: v, quantity: 1 }] });
    const second = await placeOrder({ items: [{ variantId: v, quantity: 1 }] });
    const [p1, p2] = [await transferPayment(first.orderId), await transferPayment(second.orderId)];

    const results = await Promise.all([confirmOrderPayment(p1.id, { note: "" }), confirmOrderPayment(p2.id, { note: "" })]);

    expect(results.sort()).toEqual(["confirmed", "out_of_stock"]);
    expect(await stockOf(v)).toBe(0);
    expect(await db.order.count({ where: { status: "PAID" } })).toBe(1);
  });

  it("sin stock no cambia nada: el pago y el pedido quedan como estaban", async () => {
    const { variantIds: [v] } = await createProduct({ variants: [{ stock: 5 }] });
    const { orderId } = await placeOrder({ items: [{ variantId: v, quantity: 3 }] });
    await db.productVariant.update({ where: { id: v }, data: { stock: 2 } }); // alguien compró en tienda física
    const payment = await transferPayment(orderId);

    expect(await confirmOrderPayment(payment.id, { note: "" })).toBe("out_of_stock");
    expect(await stockOf(v)).toBe(2);
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("PENDING_PAYMENT");
  });

  it("no confirma pagos de pedidos cancelados", async () => {
    const { variantIds: [v] } = await createProduct();
    const { orderId, userId } = await placeOrder({ items: [{ variantId: v, quantity: 1 }] });
    const payment = await transferPayment(orderId);
    await cancelOrderByCustomer(orderId, userId);
    expect(await confirmOrderPayment(payment.id, { note: "" })).toBe("order_not_pending");
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("CANCELLED");
    expect(await stockOf(v)).toBe(10);
  });
});

describe("transferencia bancaria", () => {
  it("comprobante → en revisión → aprobado por el admin", async () => {
    const { variantIds: [v] } = await createProduct();
    const admin = await createUser();
    const { orderId, userId } = await placeOrder({ items: [{ variantId: v, quantity: 1 }] });

    expect(await submitTransferProof(orderId, userId, "comprobantes/x/a.jpg")).toBe(true);
    const payment = await transferPayment(orderId);
    expect(payment).toMatchObject({ status: "IN_REVIEW", proofStorageId: "comprobantes/x/a.jpg" });

    // No se puede subir otro mientras está en revisión
    expect(await submitTransferProof(orderId, userId, "comprobantes/x/b.jpg")).toBe(false);

    expect(await approveTransfer(payment.id, admin.id)).toBe("confirmed");
    expect(await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
      status: "APPROVED",
      reviewedById: admin.id,
    });
  });

  it("solo el dueño del pedido puede subir comprobantes (IDOR)", async () => {
    const { variantIds: [v] } = await createProduct();
    const { orderId } = await placeOrder({ items: [{ variantId: v, quantity: 1 }] });
    const attacker = await createUser();
    expect(await submitTransferProof(orderId, attacker.id, "comprobantes/x/a.jpg")).toBe(false);
    expect((await transferPayment(orderId)).status).toBe("PENDING");
  });

  it("un comprobante rechazado permite subir otro (nuevo intento de pago)", async () => {
    const { variantIds: [v] } = await createProduct();
    const admin = await createUser();
    const { orderId, userId } = await placeOrder({ items: [{ variantId: v, quantity: 1 }] });
    await submitTransferProof(orderId, userId, "comprobantes/x/a.jpg");
    const first = await transferPayment(orderId);

    expect(await rejectTransfer(first.id, admin.id, "El monto no coincide")).toBe(true);
    expect(await approveTransfer(first.id, admin.id)).toBe("not_in_review");
    expect(await submitTransferProof(orderId, userId, "comprobantes/x/b.jpg")).toBe(true);

    const payments = await db.payment.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
    expect(payments.map((p) => p.status)).toEqual(["REJECTED", "IN_REVIEW"]);
    expect(payments[0].rejectionReason).toBe("El monto no coincide");
  });

  it("no se puede aprobar una transferencia sin comprobante", async () => {
    const { variantIds: [v] } = await createProduct();
    const { orderId } = await placeOrder({ items: [{ variantId: v, quantity: 1 }] });
    expect(await approveTransfer((await transferPayment(orderId)).id, "admin")).toBe("not_in_review");
  });
});

describe("acciones del cliente", () => {
  it("cancela un pedido pendiente propio, pero no uno ajeno ni uno con comprobante enviado", async () => {
    const { variantIds: [v] } = await createProduct();
    const a = await placeOrder({ items: [{ variantId: v, quantity: 1 }] });
    const b = await placeOrder({ items: [{ variantId: v, quantity: 1 }] });
    const stranger = await createUser();

    expect(await cancelOrderByCustomer(a.orderId, stranger.id)).toBe(false); // IDOR
    await submitTransferProof(b.orderId, b.userId, "comprobantes/x/a.jpg");
    expect(await cancelOrderByCustomer(b.orderId, b.userId)).toBe(false); // comprobante en revisión

    expect(await cancelOrderByCustomer(a.orderId, a.userId)).toBe(true);
    expect((await db.order.findUniqueOrThrow({ where: { id: a.orderId } })).status).toBe("CANCELLED");
    expect(await cancelOrderByCustomer(a.orderId, a.userId)).toBe(false); // ya cancelado
  });

  it("cambia de tarjeta a transferencia y crea el pago pendiente", async () => {
    const { variantIds: [v] } = await createProduct();
    const { orderId, userId } = await placeOrder({ items: [{ variantId: v, quantity: 1 }], method: "PAYPHONE" });

    expect(await changePaymentMethod(orderId, userId, "BANK_TRANSFER")).toBe(true);
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).paymentMethod).toBe("BANK_TRANSFER");
    expect((await transferPayment(orderId)).status).toBe("PENDING");
  });
});
