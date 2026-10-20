import { z } from "zod";

export const PAGE_SIZE = 12;

export const SORT_OPTIONS = {
  recientes: "Más recientes",
  "precio-asc": "Precio: menor a mayor",
  "precio-desc": "Precio: mayor a menor",
  nombre: "Nombre (A-Z)",
} as const;

export type SortOption = keyof typeof SORT_OPTIONS;

// Los searchParams llegan como string | string[] | undefined. Tomamos el
// primer valor y tratamos "" como ausente.
function param(value: unknown): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

const dollars = z.preprocess(param, z.coerce.number().min(0).max(100_000).optional()).catch(undefined);

// Cada campo tiene .catch(): un parámetro inválido en la URL (?pagina=abc)
// se ignora en lugar de romper la página.
export const catalogSearchSchema = z
  .object({
    q: z.preprocess(param, z.string().max(100).optional()).catch(undefined),
    categoria: z
      .preprocess(param, z.string().regex(/^[a-z0-9-]+$/).max(80).optional())
      .catch(undefined),
    min: dollars,
    max: dollars,
    orden: z
      .preprocess(param, z.enum(Object.keys(SORT_OPTIONS) as [SortOption, ...SortOption[]]).optional())
      .catch(undefined)
      .transform((v) => v ?? "recientes"),
    pagina: z
      .preprocess(param, z.coerce.number().int().min(1).max(1000).optional())
      .catch(undefined)
      .transform((v) => v ?? 1),
  })
  .transform((f) =>
    // Si el usuario invierte el rango, lo corregimos en vez de devolver cero resultados.
    f.min !== undefined && f.max !== undefined && f.min > f.max ? { ...f, min: f.max, max: f.min } : f,
  );

export type CatalogFilters = z.output<typeof catalogSearchSchema>;

export function parseCatalogSearch(raw: Record<string, string | string[] | undefined>): CatalogFilters {
  return catalogSearchSchema.parse(raw);
}
