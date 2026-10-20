import "server-only";

import { randomBytes } from "node:crypto";

import type { PaymentMethod, Prisma } from "@/generated/prisma/client";
import { getProvince } from "@/lib/data/ecuador";
import { computeOrderTotals, exceedsConsumidorFinal, CONSUMIDOR_FINAL_MAX } from "@/lib/domain/pricing";
import { formatUSD } from "@/lib/domain/money";
import { ORDER_STATUS_LABEL, canTransition, type OrderStatusValue } from "@/lib/domain/order-status";
import { variantLabel } from "@/lib/domain/variants";
import type { BillingData, CheckoutData } from "@/lib/validations/checkout";
import { db } from "@/server/db";

// Reglas de negocio de pedidos y pagos. No usa APIs de Next.js (cookies,
// caché): las Server Actions y Route Handlers resuelven la sesión y llaman aquí.
// Así todo esto se puede probar contra la base de datos real.

type Tx = Prisma.TransactionClient;

// ─── Crear pedido ───────────────────────────────────────────────────────────

export type CheckoutErrorCode = "empty_cart" | "unavailable" | "stock_changed" | "invalid_shipping" | "consumidor_final";

export class CheckoutError extends Error {
  constructor(
    public code: CheckoutErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export async function createOrderFromCart(params: {
  userId: string;
  cartId: string;
  data: CheckoutData;
  billing: BillingData;
}): Promise<{ orderId: string; number: number; total: number }> {
  const { userId, cartId, data, billing } = params;

  return db.$transaction(async (tx) => {
    const items = await tx.cartItem.findMany({
      where: { cartId },
      select: {
        quantity: true,
        variant: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            price: true,
            stock: true,
            isActive: true,
            product: { select: { name: true, price: true, isActive: true } },
          },
        },
      },
    });
    if (items.length === 0) throw new CheckoutError("empty_cart", "Tu carrito está vacío.");

    for (const { variant, quantity } of items) {
      if (!variant.isActive || !variant.product.isActive || variant.stock === 0) {
        throw new CheckoutError("unavailable", `"${variant.product.name}" ya no está disponible. Revisa tu carrito.`);
      }
      if (quantity > variant.stock) {
        throw new CheckoutError(
          "stock_changed",
          `Solo quedan ${variant.stock} de "${variant.product.name}". Ajusta la cantidad en tu carrito.`,
        );
      }
    }

    const province = getProvince(data.shipProvince);
    const rate = await tx.shippingRate.findUnique({ where: { provinceCode: data.shipProvince } });
    if (!province || !rate) throw new CheckoutError("invalid_shipping", "No hacemos envíos a esa provincia.");

    const settings = await tx.storeSettings.findUnique({ where: { id: 1 } });
    const taxRateBps = settings?.taxRateBps ?? 1500;

    // Precios SIEMPRE desde la base de datos, en el momento de comprar
    const lines = items.map(({ variant, quantity }) => ({
      variant,
      quantity,
      unitPrice: variant.price ?? variant.product.price,
    }));
    const totals = computeOrderTotals({
      lines,
      rateCost: rate.cost,
      freeShippingFrom: settings?.freeShippingFrom ?? null,
      taxRateBps,
    });

    if (billing.idType === "CONSUMIDOR_FINAL" && exceedsConsumidorFinal(totals.total)) {
      throw new CheckoutError(
        "consumidor_final",
        `Para compras mayores a ${formatUSD(CONSUMIDOR_FINAL_MAX)} el SRI exige factura con cédula o RUC.`,
      );
    }

    const order = await tx.order.create({
      data: {
        userId,
        status: "PENDING_PAYMENT",
        paymentMethod: data.paymentMethod,
        shipName: data.shipName,
        shipPhone: data.shipPhone,
        shipProvince: province.name,
        shipCity: data.shipCity,
        shipAddress: data.shipAddress,
        shipReference: data.shipReference,
        billIdType: billing.idType,
        billId: billing.id,
        billName: billing.name,
        billEmail: billing.email,
        subtotal: totals.subtotal,
        shippingCost: totals.shipping,
        taxRateBps,
        taxAmount: totals.tax,
        total: totals.total,
        items: {
          create: lines.map(({ variant, quantity, unitPrice }) => ({
            variantId: variant.id,
            productName: variant.product.name,
            variantLabel: variantLabel(variant),
            sku: variant.sku,
            unitPrice,
            quantity,
          })),
        },
        events: { create: { to: "PENDING_PAYMENT", actorId: userId, note: "Pedido creado" } },
        ...(data.paymentMethod === "BANK_TRANSFER" && {
          payments: { create: { method: "BANK_TRANSFER", status: "PENDING", amount: totals.total } },
        }),
      },
      select: { id: true, number: true, total: true },
    });

    // El pedido ya tiene su copia de los productos: el carrito se vacía.
    await tx.cartItem.deleteMany({ where: { cartId } });

    return { orderId: order.id, number: order.number, total: order.total };
  });
}

// ─── Confirmar pago y descontar stock ───────────────────────────────────────

export class OutOfStockError extends Error {
  constructor(public sku: string) {
    super(`Sin stock suficiente: ${sku}`);
  }
}

/**
 * Descuenta el stock con UPDATE … WHERE stock >= cantidad: la base de datos
 * garantiza que dos compras simultáneas de la última unidad no dejen el stock
 * en negativo (la segunda no encuentra filas y falla). Las variantes se
 * bloquean siempre en el mismo orden para evitar deadlocks entre pedidos.
 */
async function decrementStock(tx: Tx, items: { variantId: string | null; quantity: number; sku: string }[]) {
  const sorted = [...items].sort((a, b) => (a.variantId ?? "").localeCompare(b.variantId ?? ""));
  for (const item of sorted) {
    if (!item.variantId) throw new OutOfStockError(item.sku);
    const res = await tx.productVariant.updateMany({
      where: { id: item.variantId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });
    if (res.count === 0) throw new OutOfStockError(item.sku);
  }
}

export type ConfirmOutcome = "confirmed" | "already_confirmed" | "out_of_stock" | "order_not_pending";

/**
 * Aprueba un pago, descuenta el stock y marca el pedido como PAGADO, todo en
 * una transacción. Es idempotente: confirmar dos veces el mismo pago (doble
 * clic, recarga de la página de retorno) descuenta el stock una sola vez.
 */
export async function confirmOrderPayment(
  paymentId: string,
  opts: { actorId?: string | null; providerTxId?: string; providerRaw?: Prisma.InputJsonValue; note: string },
): Promise<ConfirmOutcome> {
  try {
    return await db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        select: {
          status: true,
          orderId: true,
          order: { select: { status: true, items: { select: { variantId: true, quantity: true, sku: true } } } },
        },
      });
      if (!payment) throw new Error(`Pago ${paymentId} no existe`);
      if (payment.status === "APPROVED") return "already_confirmed";
      if (payment.order.status !== "PENDING_PAYMENT") return "order_not_pending";

      // "Reclama" el pago: si otra petición ya lo aprobó, aquí no se actualiza nada.
      const claimed = await tx.payment.updateMany({
        where: { id: paymentId, status: { in: ["PENDING", "IN_REVIEW"] } },
        data: {
          status: "APPROVED",
          providerTxId: opts.providerTxId,
          providerRaw: opts.providerRaw,
          reviewedById: opts.actorId ?? null,
          reviewedAt: new Date(),
        },
      });
      if (claimed.count === 0) return "already_confirmed";

      await decrementStock(tx, payment.order.items);

      const moved = await tx.order.updateMany({
        where: { id: payment.orderId, status: "PENDING_PAYMENT" },
        data: { status: "PAID", paidAt: new Date() },
      });
      if (moved.count === 0) throw new Error("El pedido cambió de estado durante la confirmación");

      await tx.orderEvent.create({
        data: { orderId: payment.orderId, from: "PENDING_PAYMENT", to: "PAID", actorId: opts.actorId, note: opts.note },
      });
      return "confirmed";
    });
  } catch (e) {
    if (e instanceof OutOfStockError) return "out_of_stock";
    throw e;
  }
}

/**
 * Registra un cobro que no se pudo aplicar (sin stock o pedido cancelado).
 * El dinero ya se cobró: queda aprobado y anotado para que el admin decida
 * (reponer stock o reembolsar). El pedido no cambia de estado.
 */
export async function recordPaymentNeedingReview(
  paymentId: string,
  opts: { providerTxId?: string; providerRaw?: Prisma.InputJsonValue; note: string },
) {
  await db.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: { id: paymentId },
      data: { status: "APPROVED", providerTxId: opts.providerTxId, providerRaw: opts.providerRaw, reviewedAt: new Date() },
      select: { orderId: true, order: { select: { status: true } } },
    });
    await tx.orderEvent.create({
      data: { orderId: payment.orderId, from: payment.order.status, to: payment.order.status, note: opts.note },
    });
  });
}

export async function markPaymentFailed(paymentId: string, opts: { providerRaw?: Prisma.InputJsonValue; note: string }) {
  await db.$transaction(async (tx) => {
    const res = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: "FAILED", providerRaw: opts.providerRaw },
    });
    if (res.count === 0) return;
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: { orderId: true, order: { select: { status: true } } },
    });
    await tx.orderEvent.create({
      data: { orderId: payment.orderId, from: payment.order.status, to: payment.order.status, note: opts.note },
    });
  });
}

// ─── Payphone ───────────────────────────────────────────────────────────────

/** Crea un intento de pago con tarjeta. Cada intento necesita un clientTransactionId único. */
export async function createPayphoneAttempt(orderId: string, userId: string) {
  const order = await db.order.findFirst({
    where: { id: orderId, userId, status: "PENDING_PAYMENT", paymentMethod: "PAYPHONE" },
    select: { id: true, number: true, total: true, subtotal: true, taxAmount: true, billEmail: true },
  });
  if (!order) return null;

  const clientTxId = `TA-${order.number}-${randomBytes(6).toString("hex")}`;
  const payment = await db.payment.create({
    data: { orderId: order.id, method: "PAYPHONE", status: "PENDING", amount: order.total, clientTxId },
    select: { id: true },
  });
  return { paymentId: payment.id, clientTxId, order };
}

// ─── Transferencia ──────────────────────────────────────────────────────────

/** Guarda el comprobante y deja el pago "en revisión". Solo el dueño del pedido. */
export async function submitTransferProof(orderId: string, userId: string, storageKey: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId, status: "PENDING_PAYMENT", paymentMethod: "BANK_TRANSFER" },
      select: { id: true, total: true, payments: { where: { method: "BANK_TRANSFER" }, orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!order) return false;

    const latest = order.payments[0];
    if (latest && (latest.status === "APPROVED" || latest.status === "IN_REVIEW")) return false;

    if (latest && latest.status === "PENDING") {
      await tx.payment.update({ where: { id: latest.id }, data: { status: "IN_REVIEW", proofStorageId: storageKey } });
    } else {
      // Sin pago previo o el anterior fue rechazado: nuevo intento
      await tx.payment.create({
        data: {
          orderId: order.id,
          method: "BANK_TRANSFER",
          status: "IN_REVIEW",
          amount: order.total,
          proofStorageId: storageKey,
        },
      });
    }
    await tx.orderEvent.create({
      data: { orderId: order.id, from: "PENDING_PAYMENT", to: "PENDING_PAYMENT", actorId: userId, note: "Comprobante de transferencia subido" },
    });
    return true;
  });
}

export async function approveTransfer(paymentId: string, adminId: string): Promise<ConfirmOutcome | "not_in_review"> {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, select: { status: true, method: true } });
  if (!payment || payment.method !== "BANK_TRANSFER" || payment.status !== "IN_REVIEW") return "not_in_review";
  return confirmOrderPayment(paymentId, { actorId: adminId, note: "Transferencia verificada y aprobada" });
}

export async function rejectTransfer(paymentId: string, adminId: string, reason: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const res = await tx.payment.updateMany({
      where: { id: paymentId, method: "BANK_TRANSFER", status: "IN_REVIEW" },
      data: { status: "REJECTED", rejectionReason: reason, reviewedById: adminId, reviewedAt: new Date() },
    });
    if (res.count === 0) return false;
    const { orderId } = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { orderId: true } });
    await tx.orderEvent.create({
      data: { orderId, from: "PENDING_PAYMENT", to: "PENDING_PAYMENT", actorId: adminId, note: `Comprobante rechazado: ${reason}` },
    });
    return true;
  });
}

// ─── Acciones del cliente ───────────────────────────────────────────────────

async function hasPaymentInProgress(tx: Tx, orderId: string) {
  const count = await tx.payment.count({ where: { orderId, status: { in: ["IN_REVIEW", "APPROVED"] } } });
  return count > 0;
}

/** El cliente puede cancelar mientras no haya pagado ni enviado un comprobante. */
export async function cancelOrderByCustomer(orderId: string, userId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, userId, status: "PENDING_PAYMENT" }, select: { id: true } });
    if (!order || (await hasPaymentInProgress(tx, order.id))) return false;

    const res = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED" },
    });
    if (res.count === 0) return false;
    await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "FAILED" } });
    await tx.orderEvent.create({
      data: { orderId: order.id, from: "PENDING_PAYMENT", to: "CANCELLED", actorId: userId, note: "Cancelado por el cliente" },
    });
    return true;
  });
}

export async function changePaymentMethod(orderId: string, userId: string, method: PaymentMethod): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId, status: "PENDING_PAYMENT" },
      select: { id: true, total: true, paymentMethod: true },
    });
    if (!order || order.paymentMethod === method || (await hasPaymentInProgress(tx, order.id))) return false;

    await tx.order.update({ where: { id: order.id }, data: { paymentMethod: method } });
    await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "FAILED" } });
    if (method === "BANK_TRANSFER") {
      await tx.payment.create({ data: { orderId: order.id, method, status: "PENDING", amount: order.total } });
    }
    return true;
  });
}

// ─── Acciones del administrador ─────────────────────────────────────────────

export type TransitionResult = { ok: true } | { ok: false; error: string };

/**
 * Cambia el estado de un pedido respetando la máquina de estados.
 * - PAGADO solo se alcanza confirmando un pago (con descuento de stock).
 * - ENVIADO exige número de guía.
 * - Cancelar un pedido PAGADO devuelve las unidades al stock.
 */
export async function transitionOrder(
  orderId: string,
  to: OrderStatusValue,
  actorId: string,
  opts: { trackingCode?: string | null; note?: string | null } = {},
): Promise<TransitionResult> {
  if (to === "PAID") return { ok: false, error: "Para marcar un pedido como pagado, aprueba su pago." };
  if (to === "SHIPPED" && !opts.trackingCode) return { ok: false, error: "Ingresa el número de guía del envío." };

  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { status: true, items: { select: { variantId: true, quantity: true } } },
    });
    if (!order) return { ok: false, error: "Pedido no encontrado." };
    if (!canTransition(order.status, to)) {
      return {
        ok: false,
        error: `No se puede pasar de "${ORDER_STATUS_LABEL[order.status]}" a "${ORDER_STATUS_LABEL[to]}".`,
      };
    }

    // Guardado condicional: si otro admin cambió el estado al mismo tiempo, no se pisa.
    const moved = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: to, ...(to === "SHIPPED" && { trackingCode: opts.trackingCode }) },
    });
    if (moved.count === 0) return { ok: false, error: "El pedido cambió mientras lo editabas. Recarga la página." };

    let note = opts.note ?? null;
    if (to === "CANCELLED") {
      if (order.status === "PAID") {
        for (const item of order.items) {
          if (!item.variantId) continue; // la variante ya no existe
          await tx.productVariant.updateMany({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        }
        note = [note, "Stock repuesto. Recuerda reembolsar el pago al cliente."].filter(Boolean).join(" ");
      }
      await tx.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "FAILED" } });
      await tx.payment.updateMany({
        where: { orderId, status: "IN_REVIEW" },
        data: { status: "REJECTED", rejectionReason: "Pedido cancelado", reviewedById: actorId, reviewedAt: new Date() },
      });
    }
    if (to === "SHIPPED") note = [`Guía: ${opts.trackingCode}`, note].filter(Boolean).join(". ");

    await tx.orderEvent.create({ data: { orderId, from: order.status, to, actorId, note } });
    return { ok: true };
  });
}

/**
 * Resuelve un pago que quedó "para revisión" (cobrado, pero sin stock al
 * momento de confirmar). Tras reponer stock, el admin reintenta: si ahora
 * alcanza, se descuenta y el pedido pasa a PAGADO.
 */
export async function confirmReviewedPayment(
  orderId: string,
  actorId: string,
): Promise<"confirmed" | "out_of_stock" | "not_applicable"> {
  try {
    return await db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, status: "PENDING_PAYMENT", payments: { some: { status: "APPROVED" } } },
        select: { items: { select: { variantId: true, quantity: true, sku: true } } },
      });
      if (!order) return "not_applicable";

      await decrementStock(tx, order.items);
      const moved = await tx.order.updateMany({
        where: { id: orderId, status: "PENDING_PAYMENT" },
        data: { status: "PAID", paidAt: new Date() },
      });
      if (moved.count === 0) return "not_applicable";
      await tx.orderEvent.create({
        data: { orderId, from: "PENDING_PAYMENT", to: "PAID", actorId, note: "Pago revisado y pedido confirmado" },
      });
      return "confirmed";
    });
  } catch (e) {
    if (e instanceof OutOfStockError) return "out_of_stock";
    throw e;
  }
}
