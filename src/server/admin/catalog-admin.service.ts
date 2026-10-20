import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { CategoryInput, ProductInput } from "@/lib/validations/admin";
import { db } from "@/server/db";

/** Error con un mensaje apto para mostrar al administrador. */
export class AdminError extends Error {}

/**
 * Si el error es de unicidad (P2002), devuelve qué restricción falló.
 * Con el driver adapter de Postgres el detalle viene como nombre de índice
 * ("Product_slug_key") en meta.driverAdapterError, no en meta.target.
 */
function uniqueViolation(e: unknown): string[] | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") return null;
  const meta = e.meta as {
    target?: string[] | string;
    driverAdapterError?: { cause?: { constraint?: { index?: string; fields?: string[] } } };
  };
  const constraint = meta.driverAdapterError?.cause?.constraint;
  const raw = [meta.target ?? [], constraint?.fields ?? [], constraint?.index ?? []].flat();
  // "ProductVariant_sku_key" → ["ProductVariant", "sku", "key"]
  return raw.flatMap((t) => t.split("_"));
}

// ─── Productos ──────────────────────────────────────────────────────────────

/**
 * Crea o actualiza un producto con sus variantes en una transacción.
 * Las variantes que ya no vienen en el formulario se eliminan (los pedidos
 * conservan su copia, así que el historial no se pierde).
 */
export async function saveProduct(
  input: ProductInput,
  id?: string,
): Promise<{ id: string; slug: string; previousSlug: string | null }> {
  try {
    return await db.$transaction(async (tx) => {
      const category = await tx.category.findUnique({ where: { id: input.categoryId }, select: { id: true } });
      if (!category) throw new AdminError("La categoría no existe.");

      const data = {
        name: input.name,
        slug: input.slug,
        description: input.description,
        categoryId: input.categoryId,
        price: input.price,
        compareAtPrice: input.compareAtPrice,
        isActive: input.isActive,
        isFeatured: input.isFeatured,
      };

      let previousSlug: string | null = null;
      let productId: string;
      if (id) {
        const existing = await tx.product.findUnique({
          where: { id },
          select: { slug: true, variants: { select: { id: true } } },
        });
        if (!existing) throw new AdminError("El producto no existe.");
        previousSlug = existing.slug;

        // Una variante enviada con id debe pertenecer a ESTE producto
        // (evita "mover" variantes de otro producto manipulando el formulario).
        const own = new Set(existing.variants.map((v) => v.id));
        if (input.variants.some((v) => v.id && !own.has(v.id))) throw new AdminError("Variante inválida.");

        await tx.product.update({ where: { id }, data });
        const keep = new Set(input.variants.flatMap((v) => (v.id ? [v.id] : [])));
        await tx.productVariant.deleteMany({ where: { productId: id, id: { notIn: [...keep] } } });
        productId = id;
      } else {
        productId = (await tx.product.create({ data, select: { id: true } })).id;
      }

      for (const v of input.variants) {
        const variant = {
          sku: v.sku,
          size: v.size,
          color: v.color,
          colorHex: v.colorHex,
          price: v.price,
          stock: v.stock,
          isActive: v.isActive,
        };
        if (v.id) await tx.productVariant.update({ where: { id: v.id }, data: variant });
        else await tx.productVariant.create({ data: { ...variant, productId } });
      }

      return { id: productId, slug: input.slug, previousSlug };
    });
  } catch (e) {
    const fields = uniqueViolation(e);
    if (fields?.includes("slug")) throw new AdminError("Ya existe un producto con ese slug.");
    if (fields?.includes("sku")) throw new AdminError("Uno de los SKU ya lo usa otro producto.");
    if (fields) throw new AdminError("Hay variantes con la misma talla y color.");
    throw e;
  }
}

/** Elimina el producto y devuelve las claves de sus imágenes para borrarlas del almacenamiento. */
export async function deleteProduct(id: string): Promise<{ slug: string; imageKeys: string[] }> {
  const product = await db.product.findUnique({
    where: { id },
    select: { slug: true, images: { select: { storageId: true } } },
  });
  if (!product) throw new AdminError("El producto no existe.");
  await db.product.delete({ where: { id } }); // variantes, imágenes y carritos en cascada
  return { slug: product.slug, imageKeys: product.images.flatMap((i) => (i.storageId ? [i.storageId] : [])) };
}

export async function addProductImage(productId: string, image: { url: string; storageId: string; alt: string }) {
  const last = await db.productImage.findFirst({ where: { productId }, orderBy: { position: "desc" } });
  return db.productImage.create({
    data: { productId, url: image.url, storageId: image.storageId, alt: image.alt, position: (last?.position ?? -1) + 1 },
  });
}

export async function updateProductImage(imageId: string, meta: { alt: string; color: string | null }) {
  return db.productImage.update({ where: { id: imageId }, data: meta, select: { product: { select: { slug: true } } } });
}

export async function deleteProductImage(imageId: string) {
  return db.productImage.delete({
    where: { id: imageId },
    select: { storageId: true, product: { select: { slug: true } } },
  });
}

/** Mueve una imagen una posición. La primera es la portada del producto. */
export async function moveProductImage(imageId: string, direction: "up" | "down") {
  return db.$transaction(async (tx) => {
    const image = await tx.productImage.findUniqueOrThrow({
      where: { id: imageId },
      select: { productId: true, product: { select: { slug: true } } },
    });
    const images = await tx.productImage.findMany({
      where: { productId: image.productId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const ids = images.map((i) => i.id);
    const from = ids.indexOf(imageId);
    const to = direction === "up" ? from - 1 : from + 1;
    if (to >= 0 && to < ids.length) [ids[from], ids[to]] = [ids[to], ids[from]];
    // Renumera todo: corrige también posiciones duplicadas
    for (const [position, id] of ids.entries()) await tx.productImage.update({ where: { id }, data: { position } });
    return image.product.slug;
  });
}

// ─── Categorías ─────────────────────────────────────────────────────────────

/** Crea o actualiza una categoría. Devuelve la clave de la imagen anterior si se reemplazó. */
export async function saveCategory(
  input: CategoryInput,
  id?: string,
  image?: { url: string; key: string },
): Promise<{ id: string; replacedImageKey: string | null }> {
  try {
    const data = { ...input, ...(image && { imageUrl: image.url, imageStorageId: image.key }) };
    if (id) {
      const before = await db.category.findUnique({ where: { id }, select: { imageStorageId: true } });
      const updated = await db.category.update({ where: { id }, data, select: { id: true } });
      return { id: updated.id, replacedImageKey: image ? (before?.imageStorageId ?? null) : null };
    }
    return { id: (await db.category.create({ data, select: { id: true } })).id, replacedImageKey: null };
  } catch (e) {
    if (uniqueViolation(e)) throw new AdminError("Ya existe una categoría con ese slug.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      throw new AdminError("La categoría no existe.");
    }
    throw e;
  }
}

/** Elimina una categoría vacía. Devuelve la clave de su imagen para borrarla. */
export async function deleteCategory(id: string): Promise<string | null> {
  const count = await db.product.count({ where: { categoryId: id } });
  if (count > 0) {
    throw new AdminError(`La categoría tiene ${count} producto(s). Muévelos a otra categoría antes de eliminarla.`);
  }
  const deleted = await db.category.delete({ where: { id }, select: { imageStorageId: true } });
  return deleted.imageStorageId;
}
