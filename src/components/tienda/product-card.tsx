import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { discountPercent } from "@/lib/domain/money";
import type { ProductCardData } from "@/server/queries/catalog";

import { Price } from "./price";

interface Props {
  product: ProductCardData;
  /** Las primeras tarjetas visibles cargan su imagen con prioridad (mejor LCP). */
  priority?: boolean;
}

export function ProductCard({ product, priority }: Props) {
  const discount = discountPercent(product.price, product.compareAtPrice);

  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-4/5 overflow-hidden rounded-xl bg-muted">
        {product.image && (
          <Image
            src={product.image.url}
            alt={product.image.alt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            preload={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {!product.inStock && <Badge variant="secondary">Agotado</Badge>}
          {product.inStock && discount && <Badge>-{discount}%</Badge>}
        </div>
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-1">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{product.category.name}</p>
        <h3 className="line-clamp-2 text-sm font-medium sm:text-base">
          <Link href={`/productos/${product.slug}`} className="after:absolute after:inset-0">
            {product.name}
          </Link>
        </h3>
        <Price price={product.price} compareAtPrice={product.compareAtPrice} className="text-sm sm:text-base" />
        {product.colors.length > 1 && (
          <ul className="mt-1 flex gap-1.5" aria-label="Colores disponibles">
            {product.colors.map((c) => (
              <li
                key={c.name}
                title={c.name}
                className="size-3.5 rounded-full border border-black/10"
                style={{ backgroundColor: c.hex }}
              >
                <span className="sr-only">{c.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
