import { beforeEach, describe, expect, it } from "vitest";

import { CONSUMIDOR_FINAL_ID } from "@/lib/domain/ec-id";
import { addItem, getOrCreateUserCart } from "@/server/cart/cart.service";
import { db } from "@/server/db";
import { createOrderFromCart } from "@/server/orders/order.service";
import { mockTransactionId } from "@/server/payments/payphone";
import { handlePayphoneReturn, startPayphoneCheckout } from "@/server/payments/payphone-flow";

import { createProduct, createUser, resetDb, seedStoreBasics } from "./helpers";

// Flujo completo de Payphone con la pasarela simulada (PAYPHONE_MODE=mock).
// El código del servidor es el mismo que con Payphone real; solo cambia quién
// responde a Prepare/Confirm.

beforeEach(async () => {
  await resetDb();
  await seedStoreBasics();
});

async function cardOrder(stock = 5) {
  const { variantIds: [v] } = await createProduct({ price: 2000, variants: [{ stock }] });
  const user = await createUser();
  const cartId = await getOrCreateUserCart(user.id);
  await addItem(cartId, v, 1);
  const order = await createOrderFromCart({
    userId: user.id,
    cartId,
    data: {
      shipName: "Ana",
      shipPhone: "0991234567",
      shipProvince: "10",
      shipCity: "Otavalo",
      shipAddress: "Calle 1",
      shipReference: undefined,
      billingType: "consumidor_final",
      billId: undefined,
      billName: undefined,
      billEmail: undefined,
      paymentMethod: "PAYPHONE",
    },
    billing: { idType: "CONSUMIDOR_FINAL", id: CONSUMIDOR_FINAL_ID, name: "CONSUMIDOR FINAL", email: "a@b.co" },
  });
  // Inicia el pago: crea el intento y devuelve la URL de la pasarela
  const url = new URL(await startPayphoneCheckout(order.orderId, user.id, "http://tienda.test") as string);
  const tx = url.searchParams.get("tx")!;
  return { order, variantId: v, userId: user.id, tx, amount: Number(url.searchParams.get("monto")) };
}

const orderStatus = async (orderId: string) => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status;
const stockOf = async (id: string) => (await db.productVariant.findUniqueOrThrow({ where: { id } })).stock;

describe("retorno de Payphone", () => {
  it("la URL de pago lleva el total exacto del pedido", async () => {
    const { order, amount } = await cardOrder();
    expect(amount).toBe(order.total); // $20 + $3 de envío
    expect(amount).toBe(2300);
  });

  it("pago aprobado: pedido PAGADO y stock descontado", async () => {
    const { order, tx, amount, variantId } = await cardOrder();
    const result = await handlePayphoneReturn(mockTransactionId("approved", tx, amount), tx);

    expect(result).toEqual({ outcome: "aprobado", orderNumber: order.number, stockChanged: true });
    expect(await orderStatus(order.orderId)).toBe("PAID");
    expect(await stockOf(variantId)).toBe(4);
  });

  it("recargar la página de retorno no vuelve a cobrar ni a descontar stock", async () => {
    const { order, tx, amount, variantId } = await cardOrder();
    const id = mockTransactionId("approved", tx, amount);
    await handlePayphoneReturn(id, tx);
    const again = await handlePayphoneReturn(id, tx);

    expect(again).toMatchObject({ outcome: "aprobado", stockChanged: false });
    expect(await stockOf(variantId)).toBe(4);
    expect(await db.orderEvent.count({ where: { orderId: order.orderId, to: "PAID" } })).toBe(1);
  });

  it("pago rechazado: el pedido sigue pendiente y se puede reintentar", async () => {
    const { order, tx, amount, userId } = await cardOrder();
    expect((await handlePayphoneReturn(mockTransactionId("canceled", tx, amount), tx)).outcome).toBe("rechazado");
    expect(await orderStatus(order.orderId)).toBe("PENDING_PAYMENT");

    const retry = await startPayphoneCheckout(order.orderId, userId, "http://tienda.test");
    expect(retry).not.toBeNull();
  });

  it("un id falsificado (sin firma válida) no aprueba nada", async () => {
    const { order, tx, amount, variantId } = await cardOrder();
    const forged = `mock.approved.${amount}.firma-inventada`;
    expect((await handlePayphoneReturn(forged, tx)).outcome).toBe("error");
    expect(await orderStatus(order.orderId)).toBe("PENDING_PAYMENT");
    expect(await stockOf(variantId)).toBe(5);
  });

  it("si Payphone confirma un monto distinto al del pedido, no se aprueba", async () => {
    const { order, tx } = await cardOrder();
    // El cliente manipuló el monto en la pasarela y pagó $0.01
    const result = await handlePayphoneReturn(mockTransactionId("approved", tx, 1), tx);

    expect(result.outcome).toBe("error");
    expect(await orderStatus(order.orderId)).toBe("PENDING_PAYMENT");
    const payment = await db.payment.findUniqueOrThrow({ where: { clientTxId: tx } });
    expect(payment.status).toBe("FAILED");
    const event = await db.orderEvent.findFirst({ where: { orderId: order.orderId }, orderBy: { createdAt: "desc" } });
    expect(event?.note).toMatch(/no coinciden/);
  });

  it("usar el resultado de otra transacción no sirve", async () => {
    const a = await cardOrder();
    const b = await cardOrder();
    // El id aprobado de A se presenta con la transacción de B
    const idOfA = mockTransactionId("approved", a.tx, a.amount);
    expect((await handlePayphoneReturn(idOfA, b.tx)).outcome).toBe("error");
    expect(await orderStatus(b.order.orderId)).toBe("PENDING_PAYMENT");
  });

  it("pago aprobado sin stock: se registra para revisión y el pedido no se marca pagado", async () => {
    const { order, tx, amount, variantId } = await cardOrder(1);
    await db.productVariant.update({ where: { id: variantId }, data: { stock: 0 } });

    expect((await handlePayphoneReturn(mockTransactionId("approved", tx, amount), tx)).outcome).toBe("revision");
    expect(await orderStatus(order.orderId)).toBe("PENDING_PAYMENT");
    expect((await db.payment.findUniqueOrThrow({ where: { clientTxId: tx } })).status).toBe("APPROVED");
    const event = await db.orderEvent.findFirst({ where: { orderId: order.orderId }, orderBy: { createdAt: "desc" } });
    expect(event?.note).toMatch(/Requiere revisión/);
  });

  it("no se puede iniciar el pago de un pedido ajeno", async () => {
    const { order } = await cardOrder();
    const stranger = await createUser();
    expect(await startPayphoneCheckout(order.orderId, stranger.id, "http://tienda.test")).toBeNull();
  });

  it("una transacción desconocida no hace nada", async () => {
    expect(await handlePayphoneReturn("mock.approved.100.x", "TA-9999-aaaaaaaaaaaa")).toEqual({
      outcome: "error",
      orderNumber: null,
      stockChanged: false,
    });
  });
});
