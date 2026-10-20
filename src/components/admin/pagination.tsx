import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function AdminPagination({ page, pageCount, href }: { page: number; pageCount: number; href: (p: number) => string }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-end gap-2 text-sm">
      <span className="text-muted-foreground">
        Página {page} de {pageCount}
      </span>
      <Button asChild={page > 1} variant="outline" size="icon" disabled={page <= 1} aria-label="Página anterior">
        {page > 1 ? (
          <Link href={href(page - 1)}>
            <ChevronLeftIcon />
          </Link>
        ) : (
          <ChevronLeftIcon />
        )}
      </Button>
      <Button asChild={page < pageCount} variant="outline" size="icon" disabled={page >= pageCount} aria-label="Página siguiente">
        {page < pageCount ? (
          <Link href={href(page + 1)}>
            <ChevronRightIcon />
          </Link>
        ) : (
          <ChevronRightIcon />
        )}
      </Button>
    </nav>
  );
}
