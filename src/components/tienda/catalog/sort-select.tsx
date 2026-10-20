"use client";

import { useRouter } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { catalogHref } from "@/lib/catalog-url";
import { SORT_OPTIONS, type CatalogFilters, type SortOption } from "@/lib/validations/catalog";

interface Props {
  basePath: string;
  filters: CatalogFilters;
}

export function SortSelect({ basePath, filters }: Props) {
  const router = useRouter();

  return (
    <Select
      value={filters.orden}
      onValueChange={(orden: SortOption) => router.push(catalogHref(basePath, filters, { orden }), { scroll: false })}
    >
      <SelectTrigger className="h-10 min-w-48" aria-label="Ordenar por">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {Object.entries(SORT_OPTIONS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
