"use server";

import { randomUUID } from "node:crypto";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { validateProofFile, MAX_PROOF_BYTES } from "@/lib/security/file-type";
import { getSiteUrl } from "@/lib/site";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { cancelOrderByCustomer, changePaymentMethod, submitTransferProof } from "@/server/orders/order.service";
import { startPayphoneCheckout } from "@/server/payments/payphone-flow";
import { LIMITS, consumeRateLimit } from "@/server/security/rate-limit";
import { getPrivateStorage } from "@/server/storage/storage";

const orderNumberSchema = z.coerce.number().int().positive().max(2_147_483_647);

/** Resuelve el pedido SOLO si pertenece al usuario de la sesión. */
async function ownOrder(rawNumber: unknown) {
  const user = await requireUser("/cuenta");
  const number = orderNumberSchema.safeParse(rawNumber);
  if (!number.success) return null;
  const order = await db.order.findFirst({ where: { number: number.data, userId: user.id }, select: { id: true, number: true } });
  return order ? { user, order } : null;
}

export async function payWithCardAction(orderNumber: number): Promise<{ error: string } | void> {
  const owned = await ownOrder(orderNumber);
  if (!owned) return { error: "Pedido no encontrado." };

  const limit = await consumeRateLimit(`payment:user:${owned.user.id}`, LIMITS.paymentPerUser);
  if (!limit.allowed) return { error: "Demasiados intentos de pago. Espera unos minutos." };

  let url: string | null = null;
  try {
    url = await startPayphoneCheckout(owned.order.id, owned.user.id, getSiteUrl());
  } catch (e) {
    console.error("[payphone] no se pudo iniciar el pago", e);
    return { error: "No pudimos conectar con Payphone. Intenta de nuevo en unos minutos." };
  }
  if (!url) return { error: "Este pedido ya no admite pagos con tarjeta." };
  redirect(url);
}

export interface UploadProofState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function uploadProofAction(
  orderNumber: number,
  _prev: UploadProofState,
  formData: FormData,
): Promise<UploadProofState> {
  const owned = await ownOrder(orderNumber);
  if (!owned) return { status: "error", message: "Pedido no encontrado." };

  const limit = await consumeRateLimit(`upload:user:${owned.user.id}`, LIMITS.uploadPerUser);
  if (!limit.allowed) return { status: "error", message: "Demasiados archivos subidos. Espera un momento." };

  const file = formData.get("proof");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Elige un archivo." };
  if (file.size > MAX_PROOF_BYTES) return { status: "error", message: "El archivo supera los 5 MB." };

  // El tipo se decide por el contenido real, no por la extensión ni el MIME del navegador
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateProofFile(bytes);
  if (!check.ok) return { status: "error", message: check.error };

  // Nombre generado por el servidor: el nombre original nunca se usa como ruta
  const key = `comprobantes/${owned.order.id}/${randomUUID()}.${check.type.ext}`;
  const storage = getPrivateStorage();
  await storage.put(key, bytes, check.type.mime);

  const saved = await submitTransferProof(owned.order.id, owned.user.id, key);
  if (!saved) {
    await storage.remove(key);
    return { status: "error", message: "Este pedido ya no acepta comprobantes." };
  }
  refresh();
  return { status: "success", message: "Recibimos tu comprobante. Lo revisaremos pronto." };
}

export async function cancelOrderAction(orderNumber: number): Promise<{ error: string } | void> {
  const owned = await ownOrder(orderNumber);
  if (!owned) return { error: "Pedido no encontrado." };
  const ok = await cancelOrderByCustomer(owned.order.id, owned.user.id);
  if (!ok) return { error: "Este pedido ya no se puede cancelar." };
  refresh();
}

export async function changePaymentMethodAction(
  orderNumber: number,
  method: "PAYPHONE" | "BANK_TRANSFER",
): Promise<{ error: string } | void> {
  const owned = await ownOrder(orderNumber);
  if (!owned) return { error: "Pedido no encontrado." };
  const parsed = z.enum(["PAYPHONE", "BANK_TRANSFER"]).safeParse(method);
  if (!parsed.success) return { error: "Método de pago inválido." };
  const ok = await changePaymentMethod(owned.order.id, owned.user.id, parsed.data);
  if (!ok) return { error: "No se puede cambiar el método de pago de este pedido." };
  refresh();
}
