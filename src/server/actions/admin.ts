"use server";

import { randomUUID } from "node:crypto";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { DEMO_DISABLED_MESSAGE, DEMO_MODE } from "@/lib/demo";
import { validateImageFile } from "@/lib/security/file-type";
import {
  bankAccountSchema,
  categorySchema,
  imageMetaSchema,
  orderTransitionSchema,
  productSchema,
  rejectPaymentSchema,
  settingsSchema,
  shippingRatesSchema,
} from "@/lib/validations/admin";
import { idSchema } from "@/lib/validations/cart";
import { issueMap } from "@/lib/validations/issues";
import {
  AdminError,
  addProductImage,
  deleteCategory,
  deleteProduct,
  deleteProductImage,
  moveProductImage,
  saveCategory,
  saveProduct,
  updateProductImage,
} from "@/server/admin/catalog-admin.service";
import {
  deleteBankAccount,
  saveBankAccount,
  setLogo,
  updateSettings,
  updateShippingRates,
} from "@/server/admin/settings-admin.service";
import { requireAdmin } from "@/server/auth/guards";
import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";
import {
  approveTransfer,
  confirmReviewedPayment,
  rejectTransfer,
  transitionOrder,
} from "@/server/orders/order.service";
import { productTag } from "@/server/queries/catalog";
import { getPublicStorage } from "@/server/storage/storage";

// Acciones del panel. Cada una verifica el rol de admin por sí misma (son
// endpoints POST públicos: estar dentro de /admin no las protege).

export type AdminResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/** En la demo pública se bloquea lo que permitiría abusar del sitio. */
const demoBlocked = (): AdminResult | null => (DEMO_MODE ? { ok: false, error: DEMO_DISABLED_MESSAGE } : null);

const fail = (error: string, fieldErrors?: Record<string, string[] | undefined>): AdminResult => ({
  ok: false,
  error,
  fieldErrors,
});

function invalidateCatalog(...slugs: (string | null | undefined)[]) {
  updateTag(TAGS.products);
  updateTag(TAGS.categories);
  for (const slug of slugs) if (slug) updateTag(productTag(slug));
}

async function removeQuietly(key: string | null | undefined) {
  if (!key) return;
  try {
    await getPublicStorage().remove(key);
  } catch (e) {
    console.error("[storage] no se pudo borrar", key, e);
  }
}

// ─── Pedidos ────────────────────────────────────────────────────────────────

export async function approvePaymentAction(paymentId: string): Promise<AdminResult> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(paymentId);
  if (!id.success) return fail("Pago inválido.");

  const outcome = await approveTransfer(id.data, admin.id);
  refresh();
  switch (outcome) {
    case "confirmed":
      updateTag(TAGS.products); // cambió el stock
      return { ok: true, message: "Pago aprobado. El pedido pasó a Pagado." };
    case "out_of_stock":
      return fail("No hay stock suficiente para este pedido. Repón stock o rechaza el comprobante.");
    case "order_not_pending":
      return fail("El pedido ya no está pendiente de pago.");
    default:
      return fail("Este pago ya fue revisado.");
  }
}

export async function rejectPaymentAction(input: { paymentId: string; reason: string }): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = rejectPaymentSchema.safeParse(input);
  if (!parsed.success) return fail("Revisa el motivo.", z.flattenError(parsed.error).fieldErrors);
  const ok = await rejectTransfer(parsed.data.paymentId, admin.id, parsed.data.reason);
  refresh();
  return ok ? { ok: true, message: "Comprobante rechazado. El cliente puede subir otro." } : fail("Este pago ya fue revisado.");
}

export async function transitionOrderAction(input: z.input<typeof orderTransitionSchema>): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = orderTransitionSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.", z.flattenError(parsed.error).fieldErrors);

  const order = await db.order.findUnique({ where: { number: parsed.data.orderNumber }, select: { id: true, status: true } });
  if (!order) return fail("Pedido no encontrado.");

  const result = await transitionOrder(order.id, parsed.data.to, admin.id, parsed.data);
  if (!result.ok) return result;
  if (parsed.data.to === "CANCELLED" && order.status === "PAID") updateTag(TAGS.products); // stock repuesto
  refresh();
  return { ok: true, message: "Estado actualizado." };
}

export async function confirmReviewedAction(orderNumber: number): Promise<AdminResult> {
  const admin = await requireAdmin();
  const order = await db.order.findUnique({ where: { number: Number(orderNumber) }, select: { id: true } });
  if (!order) return fail("Pedido no encontrado.");
  const outcome = await confirmReviewedPayment(order.id, admin.id);
  refresh();
  if (outcome === "confirmed") {
    updateTag(TAGS.products);
    return { ok: true, message: "Pedido confirmado y stock descontado." };
  }
  return fail(outcome === "out_of_stock" ? "Todavía no hay stock suficiente." : "El pedido no tiene un pago por revisar.");
}

// ─── Productos ──────────────────────────────────────────────────────────────

export async function saveProductAction(id: string | null, input: unknown): Promise<AdminResult> {
  await requireAdmin();
  if (id !== null && !idSchema.safeParse(id).success) return fail("Producto inválido.");
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail("Revisa los campos marcados.", issueMap(parsed.error));

  let saved;
  try {
    saved = await saveProduct(parsed.data, id ?? undefined);
  } catch (e) {
    if (e instanceof AdminError) return fail(e.message);
    throw e;
  }
  invalidateCatalog(saved.slug, saved.previousSlug);
  refresh();
  return { ok: true, message: id ? "Producto guardado." : "Producto creado. Ahora sube sus imágenes.", id: saved.id };
}

export async function deleteProductAction(id: string): Promise<AdminResult> {
  await requireAdmin();
  const blocked = demoBlocked();
  if (blocked) return blocked;
  if (!idSchema.safeParse(id).success) return fail("Producto inválido.");
  let deleted;
  try {
    deleted = await deleteProduct(id);
  } catch (e) {
    if (e instanceof AdminError) return fail(e.message);
    throw e;
  }
  await Promise.all(deleted.imageKeys.map(removeQuietly));
  invalidateCatalog(deleted.slug);
  redirect("/admin/productos");
}

const MAX_IMAGES_PER_UPLOAD = 10;

export async function uploadProductImagesAction(productId: string, formData: FormData): Promise<AdminResult> {
  await requireAdmin();
  const blocked = demoBlocked();
  if (blocked) return blocked;
  if (!idSchema.safeParse(productId).success) return fail("Producto inválido.");
  const product = await db.product.findUnique({ where: { id: productId }, select: { name: true, slug: true } });
  if (!product) return fail("Producto no encontrado.");

  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return fail("Elige al menos una imagen.");
  if (files.length > MAX_IMAGES_PER_UPLOAD) return fail(`Máximo ${MAX_IMAGES_PER_UPLOAD} imágenes por vez.`);

  const errors: string[] = [];
  let uploaded = 0;
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = validateImageFile(bytes);
    if (!check.ok) {
      errors.push(`${file.name.slice(0, 60)}: ${check.error}`);
      continue;
    }
    const key = `productos/${productId}/${randomUUID()}.${check.type.ext}`;
    const url = await getPublicStorage().put(key, bytes, check.type.mime);
    await addProductImage(productId, { url, storageId: key, alt: product.name });
    uploaded++;
  }

  invalidateCatalog(product.slug);
  refresh();
  if (errors.length) return fail(`${uploaded} imagen(es) subida(s). Rechazadas: ${errors.join(" · ")}`);
  return { ok: true, message: `${uploaded} imagen(es) subida(s).` };
}

export async function updateProductImageAction(imageId: string, input: unknown): Promise<AdminResult> {
  await requireAdmin();
  if (!idSchema.safeParse(imageId).success) return fail("Imagen inválida.");
  const parsed = imageMetaSchema.safeParse(input);
  if (!parsed.success) return fail("Revisa el texto alternativo.", z.flattenError(parsed.error).fieldErrors);
  const { product } = await updateProductImage(imageId, parsed.data);
  invalidateCatalog(product.slug);
  refresh();
  return { ok: true };
}

export async function moveProductImageAction(imageId: string, direction: "up" | "down"): Promise<AdminResult> {
  await requireAdmin();
  if (!idSchema.safeParse(imageId).success || !["up", "down"].includes(direction)) return fail("Datos inválidos.");
  const slug = await moveProductImage(imageId, direction);
  invalidateCatalog(slug);
  refresh();
  return { ok: true };
}

export async function deleteProductImageAction(imageId: string): Promise<AdminResult> {
  await requireAdmin();
  if (!idSchema.safeParse(imageId).success) return fail("Imagen inválida.");
  const image = await deleteProductImage(imageId);
  await removeQuietly(image.storageId);
  invalidateCatalog(image.product.slug);
  refresh();
  return { ok: true, message: "Imagen eliminada." };
}

// ─── Categorías ─────────────────────────────────────────────────────────────

export async function saveCategoryAction(id: string | null, formData: FormData): Promise<AdminResult> {
  await requireAdmin();
  if (id !== null && !idSchema.safeParse(id).success) return fail("Categoría inválida.");
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    sortOrder: formData.get("sortOrder"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return fail("Revisa los campos marcados.", z.flattenError(parsed.error).fieldErrors);

  let image: { url: string; key: string } | undefined;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    if (DEMO_MODE) return fail(DEMO_DISABLED_MESSAGE);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = validateImageFile(bytes);
    if (!check.ok) return fail(check.error);
    const key = `categorias/${randomUUID()}.${check.type.ext}`;
    image = { key, url: await getPublicStorage().put(key, bytes, check.type.mime) };
  }

  try {
    const { replacedImageKey } = await saveCategory(parsed.data, id ?? undefined, image);
    await removeQuietly(replacedImageKey);
  } catch (e) {
    await removeQuietly(image?.key);
    if (e instanceof AdminError) return fail(e.message);
    throw e;
  }
  invalidateCatalog();
  refresh();
  return { ok: true, message: "Categoría guardada." };
}

export async function deleteCategoryAction(id: string): Promise<AdminResult> {
  await requireAdmin();
  const blocked = demoBlocked();
  if (blocked) return blocked;
  if (!idSchema.safeParse(id).success) return fail("Categoría inválida.");
  try {
    await removeQuietly(await deleteCategory(id));
  } catch (e) {
    if (e instanceof AdminError) return fail(e.message);
    throw e;
  }
  invalidateCatalog();
  refresh();
  return { ok: true, message: "Categoría eliminada." };
}

// ─── Configuración ──────────────────────────────────────────────────────────

export async function saveSettingsAction(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const blocked = demoBlocked();
  if (blocked) return blocked;
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fail("Revisa los campos marcados.", issueMap(parsed.error));
  await updateSettings(parsed.data);
  updateTag(TAGS.settings);
  refresh();
  return { ok: true, message: "Configuración guardada." };
}

export async function uploadLogoAction(formData: FormData): Promise<AdminResult> {
  await requireAdmin();
  const blocked = demoBlocked();
  if (blocked) return blocked;
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return fail("Elige una imagen.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateImageFile(bytes);
  if (!check.ok) return fail(check.error);

  const key = `tienda/logo-${randomUUID()}.${check.type.ext}`;
  const url = await getPublicStorage().put(key, bytes, check.type.mime);
  await removeQuietly(await setLogo(url, key));
  updateTag(TAGS.settings);
  refresh();
  return { ok: true, message: "Logo actualizado." };
}

export async function removeLogoAction(): Promise<AdminResult> {
  await requireAdmin();
  const blocked = demoBlocked();
  if (blocked) return blocked;
  await removeQuietly(await setLogo(null, null));
  updateTag(TAGS.settings);
  refresh();
  return { ok: true, message: "Logo eliminado." };
}

export async function saveShippingRatesAction(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const parsed = shippingRatesSchema.safeParse(input);
  if (!parsed.success) return fail("Revisa las tarifas: deben ser montos válidos.");
  await updateShippingRates(parsed.data);
  updateTag(TAGS.shipping);
  refresh();
  return { ok: true, message: "Tarifas de envío guardadas." };
}

export async function saveBankAccountAction(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const blocked = demoBlocked();
  if (blocked) return blocked;
  const parsed = bankAccountSchema.safeParse(input);
  if (!parsed.success) return fail("Revisa los campos marcados.", issueMap(parsed.error));
  await saveBankAccount(parsed.data);
  updateTag(TAGS.settings);
  refresh();
  return { ok: true, message: "Cuenta guardada." };
}

export async function deleteBankAccountAction(id: string): Promise<AdminResult> {
  await requireAdmin();
  const blocked = demoBlocked();
  if (blocked) return blocked;
  if (!idSchema.safeParse(id).success) return fail("Cuenta inválida.");
  await deleteBankAccount(id);
  updateTag(TAGS.settings);
  refresh();
  return { ok: true, message: "Cuenta eliminada." };
}
