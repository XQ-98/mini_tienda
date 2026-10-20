import { beforeEach, describe, expect, it } from "vitest";

import { MAX_QTY_PER_ITEM } from "@/lib/domain/cart";
import {
  CART_ID_PATTERN,
  addItem,
  createGuestCart,
  generateCartId,
  getCartLines,
  getOrCreateUserCart,
  mergeGuestCart,
  removeItem,
  setItemQuantity,
} from "@/server/cart/cart.service";
import { db } from "@/server/db";

import { createProduct, createUser, resetDb } from "./helpers";

beforeEach(resetDb);

const quantityOf = async (cartId: string, variantId: string) =>
  (await db.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId } } }))?.quantity ?? 0;

describe("agregar al carrito", () => {
  it("nunca agrega más unidades que el stock", async () => {
    const { variantIds: [v] } = await createProduct({ variants: [{ stock: 3 }] });
    const cart = await createGuestCart();

    expect(await addItem(cart, v, 5)).toEqual({ ok: true, quantity: 3, limited: true });
    expect(await addItem(cart, v, 1)).toEqual({ ok: false, error: "max_reached" });
    expect(await quantityOf(cart, v)).toBe(3);
  });

  it(`respeta el máximo de ${MAX_QTY_PER_ITEM} unidades por producto aunque haya más stock`, async () => {
    const { variantIds: [v] } = await createProduct({ variants: [{ stock: 500 }] });
    const cart = await createGuestCart();
    await addItem(cart, v, MAX_QTY_PER_ITEM);
    expect(await addItem(cart, v, 1)).toEqual({ ok: false, error: "max_reached" });
  });

  it("rechaza variantes agotadas, inactivas, de productos inactivos o inexistentes", async () => {
    const cart = await createGuestCart();
    const agotada = await createProduct({ variants: [{ stock: 0 }] });
    const inactiva = await createProduct({ variants: [{ stock: 5, isActive: false }] });
    const productoOculto = await createProduct({ isActive: false, variants: [{ stock: 5 }] });

    expect(await addItem(cart, agotada.variantIds[0], 1)).toEqual({ ok: false, error: "out_of_stock" });
    expect(await addItem(cart, inactiva.variantIds[0], 1)).toEqual({ ok: false, error: "not_found" });
    expect(await addItem(cart, productoOculto.variantIds[0], 1)).toEqual({ ok: false, error: "not_found" });
    expect(await addItem(cart, "cnoexiste000000000000000", 1)).toEqual({ ok: false, error: "not_found" });
    expect(await db.cartItem.count()).toBe(0);
  });
});

describe("precio siempre desde la base de datos", () => {
  it("usa el precio de la variante si existe, si no el del producto", async () => {
    const { variantIds } = await createProduct({ price: 2000, variants: [{ stock: 5 }, { stock: 5, price: 2500 }] });
    const cart = await createGuestCart();
    await addItem(cart, variantIds[0], 1);
    await addItem(cart, variantIds[1], 1);

    const prices = (await getCartLines(cart)).map((l) => l.unitPrice).sort();
    expect(prices).toEqual([2000, 2500]);
  });

  it("si el admin cambia el precio, el carrito refleja el precio nuevo (no se guarda en el carrito)", async () => {
    const { productId, variantIds: [v] } = await createProduct({ price: 2000 });
    const cart = await createGuestCart();
    await addItem(cart, v, 1);
    await db.product.update({ where: { id: productId }, data: { price: 3000 } });

    expect((await getCartLines(cart))[0].unitPrice).toBe(3000);
  });
});

describe("aislamiento entre carritos (IDOR)", () => {
  it("modificar o quitar un ítem solo afecta al carrito propio", async () => {
    const { variantIds: [v] } = await createProduct({ variants: [{ stock: 10 }] });
    const cartA = await createGuestCart();
    const cartB = await createGuestCart();
    await addItem(cartB, v, 4);

    // A intenta cambiar y borrar un ítem que solo existe en B
    await setItemQuantity(cartA, v, 1);
    await removeItem(cartA, v);

    expect(await quantityOf(cartB, v)).toBe(4);
    expect(await quantityOf(cartA, v)).toBe(0);
  });

  it("los IDs de carrito son aleatorios, únicos y con formato válido", () => {
    const ids = new Set(Array.from({ length: 2000 }, generateCartId));
    expect(ids.size).toBe(2000);
    for (const id of ids) expect(id).toMatch(CART_ID_PATTERN);
  });
});

describe("cambiar cantidad", () => {
  it("limita al stock y 0 quita el producto", async () => {
    const { variantIds: [v] } = await createProduct({ variants: [{ stock: 4 }] });
    const cart = await createGuestCart();
    await addItem(cart, v, 1);

    expect(await setItemQuantity(cart, v, 9)).toBe(4);
    expect(await setItemQuantity(cart, v, 0)).toBe(0);
    expect(await quantityOf(cart, v)).toBe(0);
  });
});

describe("fusionar carrito de invitado al iniciar sesión", () => {
  it("suma cantidades respetando el stock y elimina el carrito de invitado", async () => {
    const { variantIds: [a, b] } = await createProduct({ variants: [{ stock: 5 }, { stock: 10 }] });
    const user = await createUser();
    const userCart = await getOrCreateUserCart(user.id);
    const guest = await createGuestCart();
    await addItem(userCart, a, 3);
    await addItem(guest, a, 4); // 3 + 4 = 7 > stock 5
    await addItem(guest, b, 2);

    await mergeGuestCart(guest, userCart);

    expect(await quantityOf(userCart, a)).toBe(5);
    expect(await quantityOf(userCart, b)).toBe(2);
    expect(await db.cart.findUnique({ where: { id: guest } })).toBeNull();
  });

  it("no fusiona el carrito de OTRO usuario aunque se conozca su ID", async () => {
    const { variantIds: [v] } = await createProduct();
    const victim = await createUser();
    const attacker = await createUser();
    const victimCart = await getOrCreateUserCart(victim.id);
    const attackerCart = await getOrCreateUserCart(attacker.id);
    await addItem(victimCart, v, 2);

    // Cookie manipulada con el ID del carrito de la víctima
    await mergeGuestCart(victimCart, attackerCart);

    expect(await quantityOf(attackerCart, v)).toBe(0);
    expect(await quantityOf(victimCart, v)).toBe(2);
  });
});
