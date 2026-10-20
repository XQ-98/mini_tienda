"use server";

import { refresh } from "next/cache";

import { MAX_QTY_PER_ITEM } from "@/lib/domain/cart";
import { addToCartSchema, updateCartItemSchema } from "@/lib/validations/cart";
import { addItem, removeItem, setItemQuantity } from "@/server/cart/cart.service";
import { findCurrentCartId, getOrCreateCurrentCartId } from "@/server/cart/cart-session";

// Las Server Actions son endpoints públicos (POST): todo argumento se valida
// aquí aunque venga de nuestro propio formulario.

export type AddToCartState =
  | { status: "idle" }
  | { status: "success"; message: string; at: number }
  | { status: "error"; message: string; at: number };

export async function addToCartAction(_prev: AddToCartState, formData: FormData): Promise<AddToCartState> {
  const parsed = addToCartSchema.safeParse({
    variantId: formData.get("variantId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Elige una talla y un color disponibles.", at: Date.now() };
  }

  const cartId = await getOrCreateCurrentCartId();
  const result = await addItem(cartId, parsed.data.variantId, parsed.data.quantity);
  refresh();

  if (!result.ok) {
    const message = {
      not_found: "Este producto ya no está disponible.",
      out_of_stock: "Esta combinación está agotada.",
      max_reached: `Ya tienes en el carrito el máximo disponible (${MAX_QTY_PER_ITEM} por producto o el stock actual).`,
    }[result.error];
    return { status: "error", message, at: Date.now() };
  }
  return {
    status: "success",
    message: result.limited
      ? `Agregamos las unidades disponibles. Tienes ${result.quantity} en el carrito.`
      : "Producto agregado al carrito.",
    at: Date.now(),
  };
}

export async function updateCartItemAction(variantId: string, quantity: number): Promise<void> {
  const parsed = updateCartItemSchema.safeParse({ variantId, quantity });
  if (!parsed.success) return;
  const cartId = await findCurrentCartId();
  if (!cartId) return;
  await setItemQuantity(cartId, parsed.data.variantId, parsed.data.quantity);
  refresh();
}

export async function removeCartItemAction(variantId: string): Promise<void> {
  const parsed = updateCartItemSchema.shape.variantId.safeParse(variantId);
  if (!parsed.success) return;
  const cartId = await findCurrentCartId();
  if (!cartId) return;
  await removeItem(cartId, parsed.data);
  refresh();
}
