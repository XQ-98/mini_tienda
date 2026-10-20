import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TriangleAlertIcon } from "lucide-react";

import { CheckoutForm } from "@/components/tienda/checkout/checkout-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PROVINCES } from "@/lib/data/ecuador";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getCurrentCart } from "@/server/queries/cart";
import { getLastShipping, getShippingRates } from "@/server/queries/orders";

export const metadata: Metadata = {
  title: "Finalizar compra",
  robots: { index: false },
};

async function CheckoutContent() {
  const user = await requireUser("/checkout");
  const [cart, rates, profile, last] = await Promise.all([
    getCurrentCart(),
    getShippingRates(),
    db.user.findUnique({ where: { id: user.id }, select: { name: true, phone: true, email: true } }),
    getLastShipping(user.id),
  ]);

  const lines = cart.lines.filter((l) => l.available && l.quantity <= l.stock);
  if (cart.lines.length === 0) redirect("/carrito");

  if (cart.hasIssues) {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertDescription>
          Algunos productos de tu carrito cambiaron de stock o ya no están disponibles.{" "}
          <Link href="/carrito" className="font-medium underline">
            Revisa tu carrito
          </Link>{" "}
          antes de continuar.
        </AlertDescription>
      </Alert>
    );
  }

  // El último pedido guarda el nombre de la provincia; el formulario usa el código
  const lastProvince = PROVINCES.find((p) => p.name === last?.shipProvince)?.code ?? "";

  return (
    <CheckoutForm
      lines={lines.map((l) => ({
        variantId: l.variantId,
        name: l.name,
        variantLabel: l.variantLabel,
        image: l.image,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
      }))}
      rates={rates}
      taxRateBps={cart.taxRateBps}
      freeShippingFrom={cart.freeShippingFrom}
      defaults={{
        shipName: last?.shipName ?? profile?.name ?? "",
        shipPhone: last?.shipPhone ?? profile?.phone ?? "",
        shipProvince: lastProvince,
        shipCity: lastProvince ? (last?.shipCity ?? "") : "",
        shipAddress: last?.shipAddress ?? "",
        shipReference: last?.shipReference ?? "",
        billEmail: profile?.email ?? "",
      }}
    />
  );
}

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Finalizar compra</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" aria-busy aria-label="Cargando" />}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}
