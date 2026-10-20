import { z } from "zod";

import { MAX_QTY_PER_ITEM } from "@/lib/domain/cart";

// IDs generados por Prisma (cuid): minúsculas y dígitos. Rechazar todo lo demás
// corta de raíz intentos de inyección en este campo.
export const idSchema = z.string().regex(/^[a-z0-9]{20,40}$/, "ID inválido");

export const addToCartSchema = z.object({
  variantId: idSchema,
  quantity: z.coerce
    .number()
    .int("Cantidad inválida")
    .min(1, "Cantidad inválida")
    .max(MAX_QTY_PER_ITEM, `Máximo ${MAX_QTY_PER_ITEM} unidades por producto`),
});

// 0 significa quitar el producto del carrito.
export const updateCartItemSchema = z.object({
  variantId: idSchema,
  quantity: z.coerce.number().int().min(0).max(MAX_QTY_PER_ITEM),
});
