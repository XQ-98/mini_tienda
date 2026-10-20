// Utilidades para variantes (talla × color). Funciones puras, usadas tanto en
// el servidor como en el selector de variantes del cliente.

export interface VariantLike {
  id: string;
  size: string | null;
  color: string | null;
  colorHex?: string | null;
  stock: number;
}

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
export const ONE_SIZE = "Única";

/** Ordena tallas: letras en orden de prenda, luego medidas numéricas, "Única" al final. */
export function compareSizes(a: string, b: string): number {
  const ia = SIZE_ORDER.indexOf(a.toUpperCase());
  const ib = SIZE_ORDER.indexOf(b.toUpperCase());
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;

  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  if (a === ONE_SIZE) return 1;
  if (b === ONE_SIZE) return -1;
  return a.localeCompare(b, "es");
}

export function uniqueSizes(variants: VariantLike[]): string[] {
  return [...new Set(variants.map((v) => v.size).filter((s): s is string => !!s))].sort(compareSizes);
}

export function uniqueColors(variants: VariantLike[]): { name: string; hex: string | null }[] {
  const map = new Map<string, string | null>();
  for (const v of variants) if (v.color && !map.has(v.color)) map.set(v.color, v.colorHex ?? null);
  return [...map].map(([name, hex]) => ({ name, hex }));
}

export function findVariant<T extends VariantLike>(variants: T[], size: string | null, color: string | null): T | undefined {
  return variants.find((v) => (v.size ?? null) === size && (v.color ?? null) === color);
}

/** "M / Azul", "Azul" (talla única) o "Única". */
export function variantLabel(v: { size: string | null; color: string | null }): string {
  const parts = [v.size && v.size !== ONE_SIZE ? v.size : null, v.color].filter(Boolean);
  return parts.length ? parts.join(" / ") : ONE_SIZE;
}

/**
 * Selección inicial: el primer color con stock y, si solo hay una talla,
 * esa talla. Si hay varias tallas se deja sin elegir para que el cliente decida.
 */
export function initialSelection(variants: VariantLike[]): { size: string | null; color: string | null } {
  const sizes = uniqueSizes(variants);
  const inStock = variants.find((v) => v.stock > 0) ?? variants[0];
  return {
    color: inStock?.color ?? null,
    size: sizes.length === 1 ? sizes[0] : null,
  };
}
