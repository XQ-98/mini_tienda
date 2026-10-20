import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/server/queries/catalog";

import { ProductCard } from "./product-card";

interface Props {
  products: ProductCardData[];
  className?: string;
  priorityCount?: number;
}

export function ProductGrid({ products, className, priorityCount = 0 }: Props) {
  return (
    <ul className={cn("grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <ul
      className={cn("grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4", className)}
      aria-busy
      aria-label="Cargando productos"
    >
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="animate-pulse">
          <div className="aspect-4/5 rounded-xl bg-muted" />
          <div className="mt-3 h-3 w-1/3 rounded bg-muted" />
          <div className="mt-2 h-4 w-3/4 rounded bg-muted" />
          <div className="mt-2 h-4 w-1/4 rounded bg-muted" />
        </li>
      ))}
    </ul>
  );
}
