import Form from "next/form";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { catalogHref } from "@/lib/catalog-url";
import { cn } from "@/lib/utils";
import type { CatalogFilters as Filters } from "@/lib/validations/catalog";

interface Props {
  basePath: string;
  filters: Filters;
  categories: { name: string; slug: string; productCount: number }[];
  activeCategory?: string;
}

/**
 * Panel de filtros. Funciona sin JavaScript: las categorías son enlaces y el
 * rango de precios es un formulario GET que actualiza la URL.
 */
export function CatalogFilters({ basePath, filters, categories, activeCategory }: Props) {
  // Al cambiar de categoría se conservan búsqueda, precio y orden.
  const keep = { q: filters.q, min: filters.min, max: filters.max, orden: filters.orden };

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-sm font-semibold">Categorías</h2>
        <ul className="mt-3 flex flex-col gap-0.5 text-sm">
          <li>
            <Link
              href={catalogHref("/productos", keep)}
              className={cn(
                "block rounded-md px-2 py-2 transition-colors hover:bg-muted",
                !activeCategory && "bg-muted font-medium",
              )}
            >
              Todas
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={catalogHref(`/categoria/${c.slug}`, keep)}
                aria-current={activeCategory === c.slug ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-2 transition-colors hover:bg-muted",
                  activeCategory === c.slug && "bg-muted font-medium",
                )}
              >
                {c.name}
                <span className="text-xs text-muted-foreground tabular-nums">{c.productCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Precio (USD)</h2>
        <Form action={basePath} className="mt-3 flex flex-col gap-3">
          {filters.q && <input type="hidden" name="q" value={filters.q} />}
          {filters.categoria && <input type="hidden" name="categoria" value={filters.categoria} />}
          {filters.orden !== "recientes" && <input type="hidden" name="orden" value={filters.orden} />}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor={`${basePath}-min`} className="text-xs text-muted-foreground">
                Desde
              </Label>
              <Input
                id={`${basePath}-min`}
                name="min"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="0"
                defaultValue={filters.min}
                className="mt-1 h-10"
              />
            </div>
            <span className="pb-2.5 text-muted-foreground">–</span>
            <div className="flex-1">
              <Label htmlFor={`${basePath}-max`} className="text-xs text-muted-foreground">
                Hasta
              </Label>
              <Input
                id={`${basePath}-max`}
                name="max"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="200"
                defaultValue={filters.max}
                className="mt-1 h-10"
              />
            </div>
          </div>
          <Button type="submit" variant="outline" className="h-10">
            Aplicar precio
          </Button>
        </Form>
      </section>
    </div>
  );
}
