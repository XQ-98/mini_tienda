import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { catalogHref } from "@/lib/catalog-url";
import type { CatalogFilters } from "@/lib/validations/catalog";

interface Props {
  basePath: string;
  filters: CatalogFilters;
  page: number;
  pageCount: number;
}

/** Devuelve las páginas a mostrar, con null donde va "…". Ej: 1 … 4 5 6 … 10 */
function pageWindow(page: number, pageCount: number): (number | null)[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? [null, p] : [p]));
}

export function CatalogPagination({ basePath, filters, page, pageCount }: Props) {
  if (pageCount <= 1) return null;
  const href = (p: number) => catalogHref(basePath, filters, { pagina: p });

  return (
    <nav aria-label="Paginación" className="mt-12 flex items-center justify-center gap-1">
      {page > 1 ? (
        <Button asChild variant="ghost" className="h-10">
          <Link href={href(page - 1)} rel="prev" aria-label="Página anterior">
            <ChevronLeftIcon /> <span className="hidden sm:inline">Anterior</span>
          </Link>
        </Button>
      ) : (
        <Button variant="ghost" className="h-10" disabled aria-label="Página anterior">
          <ChevronLeftIcon /> <span className="hidden sm:inline">Anterior</span>
        </Button>
      )}

      {pageWindow(page, pageCount).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-2 text-muted-foreground" aria-hidden>
            …
          </span>
        ) : (
          <Button key={p} asChild variant={p === page ? "outline" : "ghost"} className="size-10">
            <Link href={href(p)} aria-current={p === page ? "page" : undefined} aria-label={`Página ${p}`}>
              {p}
            </Link>
          </Button>
        ),
      )}

      {page < pageCount ? (
        <Button asChild variant="ghost" className="h-10">
          <Link href={href(page + 1)} rel="next" aria-label="Página siguiente">
            <span className="hidden sm:inline">Siguiente</span> <ChevronRightIcon />
          </Link>
        </Button>
      ) : (
        <Button variant="ghost" className="h-10" disabled aria-label="Página siguiente">
          <span className="hidden sm:inline">Siguiente</span> <ChevronRightIcon />
        </Button>
      )}
    </nav>
  );
}
