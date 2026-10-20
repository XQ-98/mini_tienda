import "server-only";

import { cookies } from "next/headers";

import { getSessionUser } from "@/server/auth/guards";
import { db } from "@/server/db";

import { CART_ID_PATTERN, createGuestCart, getOrCreateUserCart, mergeGuestCart } from "./cart.service";

const CART_COOKIE = "cart_id";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function readGuestCartId(): Promise<string | null> {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  // Un valor con formato inválido se ignora sin consultar la BD.
  return value && CART_ID_PATTERN.test(value) ? value : null;
}

async function setGuestCartCookie(cartId: string) {
  (await cookies()).set(CART_COOKIE, cartId, {
    httpOnly: true, // JavaScript del navegador no puede leerla (mitiga XSS)
    sameSite: "lax", // no se envía en peticiones POST de otros sitios (mitiga CSRF)
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export async function clearGuestCartCookie() {
  (await cookies()).delete(CART_COOKIE);
}

/** Carrito actual sin crearlo. Se puede usar al renderizar. */
export async function findCurrentCartId(): Promise<string | null> {
  const user = await getSessionUser();
  if (user) {
    const cart = await db.cart.findUnique({ where: { userId: user.id }, select: { id: true } });
    return cart?.id ?? null;
  }
  const guestId = await readGuestCartId();
  if (!guestId) return null;
  // Solo carritos de invitado: la cookie nunca da acceso al carrito de una cuenta.
  const cart = await db.cart.findFirst({ where: { id: guestId, userId: null }, select: { id: true } });
  return cart?.id ?? null;
}

/** Carrito actual, creándolo si hace falta. Solo en Server Actions (escribe cookies). */
export async function getOrCreateCurrentCartId(): Promise<string> {
  const user = await getSessionUser();
  if (user) return getOrCreateUserCart(user.id);

  const existing = await findCurrentCartId();
  if (existing) return existing;

  const id = await createGuestCart();
  await setGuestCartCookie(id);
  return id;
}

/** Al iniciar sesión: pasa el carrito de invitado a la cuenta y borra la cookie. */
export async function attachGuestCartToUser(userId: string, guestCartId: string | null) {
  if (!guestCartId) return;
  const userCartId = await getOrCreateUserCart(userId);
  await mergeGuestCart(guestCartId, userCartId);
  await clearGuestCartCookie();
}
