import "server-only";

import { randomBytes } from "node:crypto";

import { clampQuantity } from "@/lib/domain/cart";
import { variantLabel } from "@/lib/domain/variants";
import { db } from "@/server/db";

// Todas las funciones reciben el cartId explícitamente y filtran por él. Nunca
// se recibe un cartId desde el navegador: lo resuelve cart-session.ts a partir
// de la sesión o de la cookie. Así un usuario no puede tocar el carrito de otro (IDOR).

/** 32 caracteres aleatorios (192 bits): imposible de adivinar por fuerza bruta. */
export function generateCartId(): string {
  return randomBytes(24).toString("base64url");
}

export const CART_ID_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export async function createGuestCart(): Promise<string> {
  const cart = await db.cart.create({ data: { id: generateCartId() }, select: { id: true } });
  return cart.id;
}

export async function getOrCreateUserCart(userId: string): Promise<string> {
  const cart = await db.cart.upsert({
    where: { userId },
    create: { id: generateCartId(), userId },
    update: {},
    select: { id: true },
  });
  return cart.id;
}

async function getPurchasableVariant(variantId: string) {
  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    select: { stock: true, isActive: true, product: { select: { isActive: true } } },
  });
  if (!variant || !variant.isActive || !variant.product.isActive) return null;
  return variant;
}

export type AddItemResult =
  | { ok: true; quantity: number; limited: boolean }
  | { ok: false; error: "not_found" | "out_of_stock" | "max_reached" };

/** Suma unidades de una variante. El precio NO se guarda: siempre se lee de la BD. */
export async function addItem(cartId: string, variantId: string, quantity: number): Promise<AddItemResult> {
  const variant = await getPurchasableVariant(variantId);
  if (!variant) return { ok: false, error: "not_found" };
  if (variant.stock <= 0) return { ok: false, error: "out_of_stock" };

  const existing = await db.cartItem.findUnique({
    where: { cartId_variantId: { cartId, variantId } },
    select: { quantity: true },
  });
  const current = existing?.quantity ?? 0;
  const desired = current + quantity;
  const final = clampQuantity(desired, variant.stock);
  if (final <= current) return { ok: false, error: "max_reached" };

  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId } },
    create: { cartId, variantId, quantity: final },
    update: { quantity: final },
  });
  return { ok: true, quantity: final, limited: final < desired };
}

/** Fija la cantidad (0 = quitar). Solo afecta ítems de `cartId`. */
export async function setItemQuantity(cartId: string, variantId: string, quantity: number): Promise<number> {
  if (quantity <= 0) {
    await removeItem(cartId, variantId);
    return 0;
  }
  const variant = await getPurchasableVariant(variantId);
  const final = clampQuantity(quantity, variant?.stock ?? 0);
  if (final === 0) {
    await removeItem(cartId, variantId);
    return 0;
  }
  await db.cartItem.updateMany({ where: { cartId, variantId }, data: { quantity: final } });
  return final;
}

export async function removeItem(cartId: string, variantId: string): Promise<void> {
  await db.cartItem.deleteMany({ where: { cartId, variantId } });
}

export async function countCartItems(cartId: string): Promise<number> {
  const agg = await db.cartItem.aggregate({ where: { cartId }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}

export interface CartLineView {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantLabel: string;
  image: { url: string; alt: string } | null;
  unitPrice: number;
  quantity: number;
  stock: number;
  available: boolean;
}

export async function getCartLines(cartId: string): Promise<CartLineView[]> {
  const items = await db.cartItem.findMany({
    where: { cartId },
    orderBy: { id: "asc" },
    select: {
      quantity: true,
      variant: {
        select: {
          id: true,
          size: true,
          color: true,
          price: true,
          stock: true,
          isActive: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              isActive: true,
              images: { select: { url: true, alt: true, color: true }, orderBy: { position: "asc" } },
            },
          },
        },
      },
    },
  });

  return items.map(({ quantity, variant }) => {
    const { product } = variant;
    const image = product.images.find((i) => i.color === variant.color) ?? product.images[0] ?? null;
    return {
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      variantLabel: variantLabel(variant),
      image: image && { url: image.url, alt: image.alt },
      unitPrice: variant.price ?? product.price,
      quantity,
      stock: variant.stock,
      available: variant.isActive && product.isActive && variant.stock > 0,
    };
  });
}

/**
 * Pasa los ítems de un carrito de invitado al carrito del usuario al iniciar
 * sesión. Suma cantidades respetando el stock y borra el carrito de invitado.
 * Solo fusiona carritos de invitado (userId null): una cookie manipulada que
 * apunte al carrito de otro usuario no tiene efecto.
 */
export async function mergeGuestCart(guestCartId: string, userCartId: string): Promise<void> {
  if (guestCartId === userCartId) return;

  await db.$transaction(async (tx) => {
    const guest = await tx.cart.findFirst({
      where: { id: guestCartId, userId: null },
      select: { items: { select: { variantId: true, quantity: true, variant: { select: { stock: true } } } } },
    });
    if (!guest) return;

    for (const item of guest.items) {
      const existing = await tx.cartItem.findUnique({
        where: { cartId_variantId: { cartId: userCartId, variantId: item.variantId } },
        select: { quantity: true },
      });
      const quantity = clampQuantity((existing?.quantity ?? 0) + item.quantity, item.variant.stock);
      if (quantity === 0) continue;
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: userCartId, variantId: item.variantId } },
        create: { cartId: userCartId, variantId: item.variantId, quantity },
        update: { quantity },
      });
    }
    await tx.cart.delete({ where: { id: guestCartId } });
  });
}
