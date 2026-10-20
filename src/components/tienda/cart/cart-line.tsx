"use client";

import { useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2Icon, Trash2Icon } from "lucide-react";

import { MAX_QTY_PER_ITEM } from "@/lib/domain/cart";
import { formatUSD } from "@/lib/domain/money";
import { cn } from "@/lib/utils";
import { removeCartItemAction, updateCartItemAction } from "@/server/actions/cart";
import type { CartLineView } from "@/server/cart/cart.service";

import { QuantityStepper } from "../quantity-stepper";

export function CartLine({ line }: { line: CartLineView }) {
  const [pending, startTransition] = useTransition();
  const overStock = line.available && line.quantity > line.stock;
  const max = Math.max(1, Math.min(line.stock, MAX_QTY_PER_ITEM));

  return (
    <li className={cn("flex gap-4 py-5", pending && "opacity-60")} data-testid="cart-line">
      <Link href={`/productos/${line.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-28">
        {line.image && <Image src={line.image.url} alt={line.image.alt} fill sizes="112px" className="object-cover" />}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/productos/${line.slug}`} className="line-clamp-2 font-medium hover:underline">
              {line.name}
            </Link>
            <p className="mt-0.5 text-sm text-muted-foreground">{line.variantLabel}</p>
            <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">{formatUSD(line.unitPrice)} c/u</p>
          </div>
          <p className="shrink-0 font-semibold tabular-nums">
            {line.available ? formatUSD(line.unitPrice * Math.min(line.quantity, line.stock)) : "—"}
          </p>
        </div>

        {!line.available && <p className="mt-2 text-sm font-medium text-destructive">Ya no está disponible</p>}
        {overStock && (
          <p className="mt-2 text-sm font-medium text-primary">
            Solo quedan {line.stock}. Se cobrarán las unidades disponibles.
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-3">
          {line.available ? (
            <QuantityStepper
              value={Math.min(line.quantity, max)}
              max={max}
              disabled={pending}
              label={`Cantidad de ${line.name}`}
              onChange={(q) => startTransition(() => updateCartItemAction(line.variantId, q))}
            />
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => startTransition(() => removeCartItemAction(line.variantId))}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-muted-foreground hover:text-destructive"
            aria-label={`Quitar ${line.name} del carrito`}
          >
            {pending ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2Icon className="size-4" />}
            <span className="hidden sm:inline">Quitar</span>
          </button>
        </div>
      </div>
    </li>
  );
}
