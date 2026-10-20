"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSiteUrl } from "@/lib/site";
import { checkoutSchema, toBilling } from "@/lib/validations/checkout";
import { requireUser } from "@/server/auth/guards";
import { findCurrentCartId } from "@/server/cart/cart-session";
import { CheckoutError, createOrderFromCart } from "@/server/orders/order.service";
import { startPayphoneCheckout } from "@/server/payments/payphone-flow";
import { LIMITS, consumeRateLimit } from "@/server/security/rate-limit";

export interface CheckoutState {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export async function placeOrderAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const user = await requireUser("/checkout");

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Revisa los datos marcados.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const limit = await consumeRateLimit(`checkout:user:${user.id}`, LIMITS.checkoutPerUser);
  if (!limit.allowed) return { error: "Demasiados intentos. Espera unos minutos." };

  const cartId = await findCurrentCartId();
  if (!cartId) return { error: "Tu carrito está vacío." };

  let order;
  try {
    order = await createOrderFromCart({
      userId: user.id,
      cartId,
      data: parsed.data,
      billing: toBilling(parsed.data, user.email!),
    });
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message };
    throw e;
  }

  // Con tarjeta se va directo a Payphone; si Payphone falla, el pedido queda
  // creado y el cliente puede reintentar desde la página del pedido.
  if (parsed.data.paymentMethod === "PAYPHONE") {
    let payUrl: string | null = null;
    try {
      payUrl = await startPayphoneCheckout(order.orderId, user.id, getSiteUrl());
    } catch (e) {
      console.error("[payphone] no se pudo iniciar el pago", e);
    }
    refresh();
    redirect(payUrl ?? `/cuenta/pedidos/${order.number}?pago=error`);
  }

  // El carrito quedó vacío: refresca el header (contador) además de navegar
  refresh();
  redirect(`/cuenta/pedidos/${order.number}?nuevo=1`);
}
