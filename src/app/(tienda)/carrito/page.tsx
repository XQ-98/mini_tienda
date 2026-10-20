import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightIcon, LockIcon, ShoppingBagIcon } from "lucide-react";

import { CartLine } from "@/components/tienda/cart/cart-line";
import { Button } from "@/components/ui/button";
import { formatUSD } from "@/lib/domain/money";
import { getCurrentCart } from "@/server/queries/cart";

export const metadata: Metadata = {
  title: "Carrito",
  robots: { index: false },
};

async function CartContent() {
  const cart = await getCurrentCart();

  if (cart.lines.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-16 text-center">
        <ShoppingBagIcon className="size-10 text-muted-foreground" />
        <h2 className="mt-4 font-heading text-xl font-semibold">Tu carrito está vacío</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Explora el catálogo y agrega tus prendas favoritas.
        </p>
        <Button asChild className="mt-6 h-11 px-6">
          <Link href="/productos">Ver catálogo</Link>
        </Button>
      </div>
    );
  }

  const { summary } = cart;
  const missingForFree = cart.freeShippingFrom ? cart.freeShippingFrom - summary.total : null;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <ul className="divide-y border-y" aria-label="Productos en el carrito">
        {cart.lines.map((line) => (
          <CartLine key={line.variantId} line={line} />
        ))}
      </ul>

      <aside className="h-fit rounded-xl border bg-card p-5 lg:sticky lg:top-24" aria-label="Resumen">
        <h2 className="font-heading text-lg font-semibold">Resumen</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Productos ({summary.itemCount})</dt>
            <dd className="tabular-nums">{formatUSD(summary.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Envío</dt>
            <dd className="text-muted-foreground">Se calcula en el checkout</dd>
          </div>
          <div className="flex justify-between border-t pt-3 text-base font-semibold">
            <dt>Subtotal</dt>
            <dd className="tabular-nums" data-testid="cart-total">
              {formatUSD(summary.total)}
            </dd>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <dt>Incluye IVA {cart.taxRateBps / 100}%</dt>
            <dd className="tabular-nums">{formatUSD(summary.tax)}</dd>
          </div>
        </dl>

        {missingForFree !== null && (
          <p className="mt-4 rounded-lg bg-secondary px-3 py-2 text-sm">
            {missingForFree > 0
              ? `Te faltan ${formatUSD(missingForFree)} para el envío gratis.`
              : "¡Tu pedido tiene envío gratis!"}
          </p>
        )}

        <Button asChild size="lg" className="mt-5 h-12 w-full text-base" aria-disabled={summary.itemCount === 0}>
          <Link href="/checkout">
            Continuar compra <ArrowRightIcon />
          </Link>
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <LockIcon className="size-3.5" /> Pago seguro con Payphone o transferencia
        </p>
      </aside>
    </div>
  );
}

export default function CartPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Tu carrito</h1>
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" aria-busy aria-label="Cargando carrito" />}
      >
        <CartContent />
      </Suspense>
    </div>
  );
}
