import type { CatalogFilters } from "@/lib/validations/catalog";

type Params = Partial<Omit<CatalogFilters, "orden" | "pagina">> & {
  orden?: string;
  pagina?: number;
};

/**
 * Construye la URL del catálogo a partir de los filtros actuales y los cambios.
 * Un valor `undefined` en `changes` quita ese filtro. Cualquier cambio que no
 * sea de página vuelve a la página 1.
 */
export function catalogHref(basePath: string, current: Params, changes: Params = {}): string {
  const resetsPage = Object.keys(changes).some((k) => k !== "pagina");
  const merged: Params = { ...current, ...(resetsPage ? { pagina: undefined } : {}), ...changes };

  const sp = new URLSearchParams();
  if (merged.q) sp.set("q", merged.q);
  if (merged.categoria) sp.set("categoria", merged.categoria);
  if (merged.min !== undefined) sp.set("min", String(merged.min));
  if (merged.max !== undefined) sp.set("max", String(merged.max));
  if (merged.orden && merged.orden !== "recientes") sp.set("orden", merged.orden);
  if (merged.pagina && merged.pagina > 1) sp.set("pagina", String(merged.pagina));

  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
