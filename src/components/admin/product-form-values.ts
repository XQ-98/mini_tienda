// Conversión producto (BD) ↔ formulario. Módulo compartido: lo usan la página
// del servidor y el formulario del cliente, así que no lleva "use client".

export interface VariantRow {
  key: string;
  id?: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  price: string;
  stock: string;
  isActive: boolean;
}

export interface ProductFormValues {
  id?: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  price: string;
  compareAtPrice: string;
  isActive: boolean;
  isFeatured: boolean;
  variants: Omit<VariantRow, "key">[];
}

const toDollars = (cents: number | null | undefined) => (cents == null ? "" : (cents / 100).toFixed(2));
export const productToForm = (p: {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  price: number;
  compareAtPrice: number | null;
  isActive: boolean;
  isFeatured: boolean;
  variants: { id: string; sku: string; size: string | null; color: string | null; colorHex: string | null; price: number | null; stock: number; isActive: boolean }[];
}): ProductFormValues => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  description: p.description,
  categoryId: p.categoryId,
  price: toDollars(p.price),
  compareAtPrice: toDollars(p.compareAtPrice),
  isActive: p.isActive,
  isFeatured: p.isFeatured,
  variants: p.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    size: v.size ?? "",
    color: v.color ?? "",
    colorHex: v.colorHex ?? "#888888",
    price: toDollars(v.price),
    stock: String(v.stock),
    isActive: v.isActive,
  })),
});
