"use client";

import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, Loader2Icon, ShoppingBagIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { MAX_QTY_PER_ITEM } from "@/lib/domain/cart";
import { discountPercent } from "@/lib/domain/money";
import {
  ONE_SIZE,
  findVariant,
  initialSelection,
  uniqueColors,
  uniqueSizes,
} from "@/lib/domain/variants";
import { cn } from "@/lib/utils";
import { addToCartAction, type AddToCartState } from "@/server/actions/cart";
import type { ProductDetail } from "@/server/queries/catalog";

import { Price } from "../price";
import { QuantityStepper } from "../quantity-stepper";
import { ProductGallery } from "./product-gallery";

interface Props {
  product: Pick<ProductDetail, "name" | "price" | "compareAtPrice" | "images" | "variants">;
  lowStockThreshold: number;
  /** Encabezado (categoría y nombre) renderizado en el servidor */
  header: ReactNode;
  /** Descripción y detalles renderizados en el servidor */
  children: ReactNode;
}

export function ProductView({ product, lowStockThreshold, header, children }: Props) {
  const router = useRouter();
  const { variants, images } = product;

  const sizes = useMemo(() => uniqueSizes(variants), [variants]);
  const colors = useMemo(() => uniqueColors(variants), [variants]);
  const initial = useMemo(() => initialSelection(variants), [variants]);

  const [color, setColor] = useState(initial.color);
  const [size, setSize] = useState(initial.size);
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(() => {
    const i = images.findIndex((img) => img.color === initial.color);
    return i === -1 ? 0 : i;
  });

  const variant = size ? findVariant(variants, size, color) : undefined;
  const stock = variant?.stock ?? 0;
  const maxQty = Math.max(1, Math.min(stock, MAX_QTY_PER_ITEM));
  const displayPrice = variant?.price ?? product.price;
  const discount = discountPercent(displayPrice, product.compareAtPrice);

  const [state, formAction, pending] = useActionState<AddToCartState, FormData>(addToCartAction, {
    status: "idle",
  });

  // Notificación al terminar la acción. `at` distingue dos resultados iguales seguidos.
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message, {
        action: { label: "Ver carrito", onClick: () => router.push("/carrito") },
      });
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state, router]);

  function selectColor(name: string) {
    setColor(name);
    setQuantity(1);
    const i = images.findIndex((img) => img.color === name);
    if (i !== -1) setImageIndex(i);
  }

  const sizeStock = (s: string) => findVariant(variants, s, color)?.stock ?? 0;

  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-12">
      <div className="md:sticky md:top-24 md:self-start">
        <ProductGallery images={images} index={imageIndex} onIndexChange={setImageIndex} />
      </div>

      <div className="flex flex-col">
        {header}

        <div className="mt-3 flex items-center gap-3">
          <Price price={displayPrice} compareAtPrice={product.compareAtPrice} className="text-2xl" />
          {discount && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary">
              -{discount}%
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">IVA incluido</p>

        <form action={formAction} className="mt-6 flex flex-col gap-6">
          {colors.length > 0 && (
            <fieldset>
              <legend className="text-sm font-medium">
                Color: <span className="font-normal text-muted-foreground">{color ?? "Elige uno"}</span>
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {colors.map((c) => (
                  <label
                    key={c.name}
                    title={c.name}
                    className={cn(
                      "relative flex size-11 cursor-pointer items-center justify-center rounded-full border-2 transition has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                      color === c.name ? "border-primary" : "border-transparent hover:border-border",
                    )}
                  >
                    <input
                      type="radio"
                      name="color"
                      value={c.name}
                      checked={color === c.name}
                      onChange={() => selectColor(c.name)}
                      className="sr-only"
                    />
                    <span
                      className="size-8 rounded-full border border-black/10"
                      style={{ backgroundColor: c.hex ?? undefined }}
                    />
                    <span className="sr-only">{c.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {sizes.length > 0 && !(sizes.length === 1 && sizes[0] === ONE_SIZE) && (
            <fieldset>
              <legend className="text-sm font-medium">
                Talla: <span className="font-normal text-muted-foreground">{size ?? "Elige una"}</span>
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {sizes.map((s) => {
                  const soldOut = sizeStock(s) === 0;
                  return (
                    <label
                      key={s}
                      className={cn(
                        "flex h-11 min-w-12 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm transition has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                        size === s
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card hover:border-foreground/40",
                        soldOut && "cursor-not-allowed text-muted-foreground line-through opacity-60",
                      )}
                    >
                      <input
                        type="radio"
                        name="size"
                        value={s}
                        checked={size === s}
                        disabled={soldOut}
                        onChange={() => {
                          setSize(s);
                          setQuantity(1);
                        }}
                        className="sr-only"
                      />
                      {s}
                      {soldOut && <span className="sr-only"> (agotada)</span>}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <StockMessage hasSelection={!!variant} stock={stock} lowStockThreshold={lowStockThreshold} />

          <input type="hidden" name="variantId" value={variant?.id ?? ""} />
          <div className="flex gap-3">
            <QuantityStepper
              name="quantity"
              value={Math.min(quantity, maxQty)}
              max={maxQty}
              onChange={setQuantity}
              disabled={!variant || stock === 0}
            />
            <Button
              type="submit"
              size="lg"
              className="h-11 flex-1 text-base"
              disabled={!variant || stock === 0 || pending}
            >
              {pending ? <Loader2Icon className="animate-spin" /> : <ShoppingBagIcon />}
              {!variant ? "Elige una talla" : stock === 0 ? "Agotado" : "Agregar al carrito"}
            </Button>
          </div>
        </form>

        {children}
      </div>
    </div>
  );
}

function StockMessage({
  hasSelection,
  stock,
  lowStockThreshold,
}: {
  hasSelection: boolean;
  stock: number;
  lowStockThreshold: number;
}) {
  if (!hasSelection) return null;
  if (stock === 0) {
    return <p className="text-sm font-medium text-destructive">Agotado en esta combinación</p>;
  }
  if (stock <= lowStockThreshold) {
    return (
      <p className="text-sm font-medium text-primary">
        ¡Quedan solo {stock} {stock === 1 ? "unidad" : "unidades"}!
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-sm text-success">
      <CheckIcon className="size-4" /> Disponible
    </p>
  );
}
