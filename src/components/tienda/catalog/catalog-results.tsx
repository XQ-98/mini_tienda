import Link from "next/link";
import { SearchXIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { catalogHref } from "@/lib/catalog-url";
import { formatUSD, dollarsToCents } from "@/lib/domain/money";
import { parseCatalogSearch, type CatalogFilters as Filters } from "@/lib/validations/catalog";
import { getCatalogPage, getCategories } from "@/server/queries/catalog";

import { ProductGrid, ProductGridSkeleton } from "../product-grid";
import { CatalogFilters } from "./catalog-filters";
import { CatalogPagination } from "./catalog-pagination";
import { MobileFilters } from "./mobile-filters";
import { SortSelect } from "./sort-select";

type SearchParams = Record<string, string | string[] | undefined>;

interface Props {
  basePath: string;
  searchParams: Promise<SearchParams>;
  /** Categoría fija cuando la ruta es /categoria/[slug]. */
  categorySlug?: string;
}

export async function CatalogResults({ basePath, searchParams, categorySlug }: Props) {
  const parsed = parseCatalogSearch(await searchParams);
  const filters: Filters = categorySlug ? { ...parsed, categoria: categorySlug } : parsed;
  // Si la categoría va en la ruta, no se repite en el query string de los enlaces.
  const linkFilters: Filters = categorySlug ? { ...filters, categoria: undefined } : filters;

  const [catalog, categories] = await Promise.all([getCatalogPage(filters), getCategories()]);
  const activeCount =
    (filters.q ? 1 : 0) + (filters.min !== undefined ? 1 : 0) + (filters.max !== undefined ? 1 : 0);

  const filterPanel = (
    <CatalogFilters
      basePath={basePath}
      filters={linkFilters}
      categories={categories}
      activeCategory={filters.categoria}
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[14rem_1fr] lg:gap-10">
      <aside className="hidden lg:block" aria-label="Filtros">
        {filterPanel}
      </aside>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {filters.q && (
              <>
                Resultados para <span className="font-medium text-foreground">“{filters.q}”</span> ·{" "}
              </>
            )}
            {catalog.total} {catalog.total === 1 ? "producto" : "productos"}
          </p>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <MobileFilters activeCount={activeCount}>{filterPanel}</MobileFilters>
            <div className="ml-auto">
              <SortSelect basePath={basePath} filters={linkFilters} />
            </div>
          </div>
        </div>

        <ActiveFilters basePath={basePath} filters={linkFilters} />

        {catalog.products.length > 0 ? (
          <ProductGrid products={catalog.products} priorityCount={4} className="mt-6 lg:grid-cols-3" />
        ) : (
          <EmptyState />
        )}

        <CatalogPagination
          basePath={basePath}
          filters={linkFilters}
          page={catalog.page}
          pageCount={catalog.pageCount}
        />
      </div>
    </div>
  );
}

function ActiveFilters({ basePath, filters }: { basePath: string; filters: Filters }) {
  const chips = [
    filters.q && { label: `“${filters.q}”`, href: catalogHref(basePath, filters, { q: undefined }) },
    filters.min !== undefined && {
      label: `Desde ${formatUSD(dollarsToCents(filters.min))}`,
      href: catalogHref(basePath, filters, { min: undefined }),
    },
    filters.max !== undefined && {
      label: `Hasta ${formatUSD(dollarsToCents(filters.max))}`,
      href: catalogHref(basePath, filters, { max: undefined }),
    },
  ].filter(Boolean) as { label: string; href: string }[];

  if (chips.length === 0) return null;

  return (
    <ul className="mt-4 flex flex-wrap gap-2" aria-label="Filtros activos">
      {chips.map((chip) => (
        <li key={chip.label}>
          <Link
            href={chip.href}
            className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-sm hover:bg-muted"
          >
            {chip.label}
            <XIcon className="size-3.5" aria-label="Quitar filtro" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed px-6 py-16 text-center">
      <SearchXIcon className="size-10 text-muted-foreground" />
      <h2 className="mt-4 font-heading text-xl font-semibold">No encontramos productos</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Prueba con otra palabra, amplía el rango de precios o revisa todo el catálogo.
      </p>
      <Button asChild className="mt-6 h-10">
        <Link href="/productos">Ver todo el catálogo</Link>
      </Button>
    </div>
  );
}

export function CatalogSkeleton() {
  return (
    <div className="lg:grid lg:grid-cols-[14rem_1fr] lg:gap-10">
      <div className="hidden space-y-3 lg:block">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
      <div>
        <div className="flex justify-between">
          <div className="h-5 w-28 animate-pulse rounded bg-muted" />
          <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
        </div>
        <ProductGridSkeleton count={9} className="mt-6 lg:grid-cols-3" />
      </div>
    </div>
  );
}
