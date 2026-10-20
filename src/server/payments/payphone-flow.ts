import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import {
  confirmOrderPayment,
  createPayphoneAttempt,
  markPaymentFailed,
  recordPaymentNeedingReview,
} from "@/server/orders/order.service";

import { confirmPayment, preparePayment } from "./payphone";

export type ReturnOutcome = "aprobado" | "rechazado" | "pendiente" | "revision" | "error";

/** Crea un intento de pago y devuelve la URL de Payphone (o null si el pedido no admite pago). */
export async function startPayphoneCheckout(orderId: string, userId: string, siteUrl: string): Promise<string | null> {
  const attempt = await createPayphoneAttempt(orderId, userId);
  if (!attempt) return null;
  const { order, clientTxId } = attempt;

  return preparePayment(
    {
      amount: order.total,
      amountWithTax: order.subtotal,
      tax: order.taxAmount,
      clientTransactionId: clientTxId,
      reference: `Pedido #${order.number}`,
      email: order.billEmail,
      responseUrl: `${siteUrl}/api/pagos/payphone/retorno`,
      cancellationUrl: `${siteUrl}/cuenta/pedidos/${order.number}?pago=cancelado`,
    },
    siteUrl,
  );
}

/**
 * Procesa el regreso desde Payphone. No confía en los parámetros de la URL:
 * consulta el resultado real a Payphone y verifica que la transacción y el
 * monto coincidan con el pago registrado antes de aprobar el pedido.
 */
export async function handlePayphoneReturn(
  id: string,
  clientTxId: string,
): Promise<{ outcome: ReturnOutcome; orderNumber: number | null; stockChanged: boolean }> {
  const payment = await db.payment.findUnique({
    where: { clientTxId },
    select: { id: true, status: true, amount: true, method: true, order: { select: { number: true } } },
  });
  if (!payment || payment.method !== "PAYPHONE") return { outcome: "error", orderNumber: null, stockChanged: false };

  const done = (outcome: ReturnOutcome, stockChanged = false) => ({
    outcome,
    orderNumber: payment.order.number,
    stockChanged,
  });

  // Recargar la página de retorno no vuelve a procesar el pago
  if (payment.status === "APPROVED") return done("aprobado");
  if (payment.status !== "PENDING") return done("rechazado");

  let result;
  try {
    result = await confirmPayment(id, clientTxId);
  } catch (e) {
    console.error("[payphone] confirmación fallida", e);
    return done("error");
  }
  const raw = result.raw as Prisma.InputJsonValue;

  if (result.clientTransactionId !== clientTxId || result.amount !== payment.amount) {
    await markPaymentFailed(payment.id, {
      providerRaw: raw,
      note: `Payphone devolvió datos que no coinciden con el pago (monto ${result.amount}, esperado ${payment.amount}). Requiere revisión.`,
    });
    return done("error");
  }
  if (result.status === "canceled") {
    await markPaymentFailed(payment.id, { providerRaw: raw, note: "Pago con tarjeta rechazado o cancelado" });
    return done("rechazado");
  }
  if (result.status !== "approved") return done("pendiente");

  const outcome = await confirmOrderPayment(payment.id, {
    providerTxId: result.transactionId,
    providerRaw: raw,
    note: "Pago con tarjeta aprobado (Payphone)",
  });

  if (outcome === "out_of_stock") {
    await recordPaymentNeedingReview(payment.id, {
      providerTxId: result.transactionId,
      providerRaw: raw,
      note: "Pago con tarjeta aprobado, pero ya no hay stock suficiente. Requiere revisión: reponer stock o reembolsar.",
    });
    return done("revision");
  }
  if (outcome === "order_not_pending") {
    await recordPaymentNeedingReview(payment.id, {
      providerTxId: result.transactionId,
      providerRaw: raw,
      note: "Pago recibido en un pedido que ya no estaba pendiente. Requiere reembolso.",
    });
    return done("revision");
  }
  return done("aprobado", outcome === "confirmed");
}
