import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Cliente de la "Cajita/Botón de pagos" de Payphone.
//   1. Prepare: crea la transacción y devuelve la URL de pago.
//   2. El cliente paga en Payphone y vuelve a responseUrl con ?id=&clientTransactionId=
//   3. Confirm (V2): el servidor consulta el resultado real. Payphone revierte el
//      cobro si no se confirma en unos minutos, por eso la confirmación es obligatoria.
//
// PAYPHONE_MODE=mock usa una pasarela simulada (/pago-simulado) para desarrollo
// y tests E2E. Nunca debe usarse en una tienda real.

const API = "https://pay.payphonetodoaldia.com/api/button";

export type PayphoneMode = "live" | "mock";

export function payphoneMode(): PayphoneMode {
  return process.env.PAYPHONE_MODE === "mock" ? "mock" : "live";
}

export class PayphoneError extends Error {}

export interface PrepareInput {
  amount: number; // centavos
  amountWithTax: number; // base gravada con IVA
  tax: number;
  clientTransactionId: string;
  reference: string;
  email: string;
  responseUrl: string;
  cancellationUrl: string;
}

export interface ConfirmResult {
  status: "approved" | "canceled" | "pending";
  transactionId: string;
  clientTransactionId: string;
  amount: number;
  raw: unknown;
}

// ─── Modo simulado ──────────────────────────────────────────────────────────
// El "id" que devuelve la pasarela simulada lleva la decisión y el monto
// firmados con HMAC: no se puede fabricar un pago aprobado editando la URL.

type MockDecision = "approved" | "canceled";

function mockSignature(decision: MockDecision, clientTxId: string, amount: number): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new PayphoneError("AUTH_SECRET no configurado");
  return createHmac("sha256", secret).update(`${decision}|${clientTxId}|${amount}`).digest("base64url");
}

export function mockTransactionId(decision: MockDecision, clientTxId: string, amount: number): string {
  return `mock.${decision}.${amount}.${mockSignature(decision, clientTxId, amount)}`;
}

export function verifyMockTransactionId(
  id: string,
  clientTxId: string,
): { decision: MockDecision; amount: number } | null {
  const [prefix, decision, amountText, signature] = id.split(".");
  if (prefix !== "mock" || (decision !== "approved" && decision !== "canceled") || !signature) return null;
  const amount = Number(amountText);
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;

  const expected = Buffer.from(mockSignature(decision, clientTxId, amount));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return { decision, amount };
}

// ─── API ────────────────────────────────────────────────────────────────────

function credentials() {
  const token = process.env.PAYPHONE_TOKEN;
  const storeId = process.env.PAYPHONE_STORE_ID;
  if (!token || !storeId) throw new PayphoneError("Payphone no está configurado (PAYPHONE_TOKEN / PAYPHONE_STORE_ID)");
  return { token, storeId };
}

/** Crea la transacción y devuelve la URL a la que se envía al cliente. */
export async function preparePayment(input: PrepareInput, siteUrl: string): Promise<string> {
  if (payphoneMode() === "mock") {
    const params = new URLSearchParams({
      tx: input.clientTransactionId,
      monto: String(input.amount),
      ref: input.reference,
    });
    return `${siteUrl}/pago-simulado?${params}`;
  }

  const { token, storeId } = credentials();
  const res = await fetch(`${API}/Prepare`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: input.amount,
      amountWithoutTax: 0,
      amountWithTax: input.amountWithTax,
      tax: input.tax,
      service: 0,
      tip: 0,
      currency: "USD",
      clientTransactionId: input.clientTransactionId,
      storeId,
      reference: input.reference,
      email: input.email,
      responseUrl: input.responseUrl,
      cancellationUrl: input.cancellationUrl,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as { payWithCard?: string; message?: string } | null;
  if (!res.ok || !body?.payWithCard) {
    throw new PayphoneError(`Payphone Prepare falló (${res.status}): ${body?.message ?? "sin detalle"}`);
  }
  return body.payWithCard;
}

/** Consulta a Payphone el resultado real de la transacción. */
export async function confirmPayment(id: string, clientTxId: string): Promise<ConfirmResult> {
  if (payphoneMode() === "mock") {
    const mock = verifyMockTransactionId(id, clientTxId);
    if (!mock) throw new PayphoneError("Transacción simulada inválida");
    return {
      status: mock.decision,
      transactionId: id,
      clientTransactionId: clientTxId,
      amount: mock.amount,
      raw: { mock: true, decision: mock.decision },
    };
  }

  const { token } = credentials();
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId)) throw new PayphoneError("Id de transacción inválido");

  const res = await fetch(`${API}/V2/Confirm`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: numericId, clientTxId }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as {
    statusCode?: number;
    transactionId?: number;
    clientTransactionId?: string;
    amount?: number;
  } | null;
  if (!res.ok || !body) throw new PayphoneError(`Payphone Confirm falló (${res.status})`);

  // statusCode: 3 = aprobada, 2 = cancelada
  return {
    status: body.statusCode === 3 ? "approved" : body.statusCode === 2 ? "canceled" : "pending",
    transactionId: String(body.transactionId ?? id),
    clientTransactionId: body.clientTransactionId ?? "",
    amount: body.amount ?? -1,
    raw: body,
  };
}
