import "server-only";

import { summarizeCart } from "@/lib/domain/cart";
import { countCartItems, getCartLines } from "@/server/cart/cart.service";
import { findCurrentCartId } from "@/server/cart/cart-session";
import { getStoreSettings } from "@/server/queries/settings";

// Lecturas del carrito: dependen de la sesión/cookie, así que no se cachean y
// deben renderizarse dentro de <Suspense>.

export async function getCurrentCartCount(): Promise<number> {
  const cartId = await findCurrentCartId();
  return cartId ? countCartItems(cartId) : 0;
}

export async function getCurrentCart() {
  const [cartId, settings] = await Promise.all([findCurrentCartId(), getStoreSettings()]);
  const lines = cartId ? await getCartLines(cartId) : [];
  // Solo se cobra lo que se puede comprar: líneas no disponibles quedan fuera del total.
  const purchasable = lines
    .filter((l) => l.available)
    .map((l) => ({ unitPrice: l.unitPrice, quantity: Math.min(l.quantity, l.stock) }));

  return {
    lines,
    summary: summarizeCart(purchasable, settings.taxRateBps),
    taxRateBps: settings.taxRateBps,
    freeShippingFrom: settings.freeShippingFrom,
    hasIssues: lines.some((l) => !l.available || l.quantity > l.stock),
  };
}

export type CurrentCart = Awaited<ReturnType<typeof getCurrentCart>>;
