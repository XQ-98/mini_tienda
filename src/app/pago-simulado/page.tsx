import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CreditCardIcon, FlaskConicalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatUSD } from "@/lib/domain/money";
import { mockTransactionId, payphoneMode } from "@/server/payments/payphone";

export const metadata: Metadata = {
  title: "Pasarela de pagos simulada",
  robots: { index: false },
};

// Imita la página de Payphone para desarrollo y tests E2E. Solo existe con
// PAYPHONE_MODE=mock; con Payphone real esta ruta responde 404.

async function MockGateway({ searchParams }: Pick<PageProps<"/pago-simulado">, "searchParams">) {
  if (payphoneMode() !== "mock") notFound();

  const params = await searchParams;
  const tx = typeof params.tx === "string" ? params.tx : "";
  const amount = Number(params.monto);
  const reference = typeof params.ref === "string" ? params.ref : "";
  if (!/^TA-\d{1,10}-[a-f0-9]{12}$/.test(tx) || !Number.isSafeInteger(amount) || amount <= 0) notFound();

  const back = (decision: "approved" | "canceled") =>
    `/api/pagos/payphone/retorno?${new URLSearchParams({
      id: mockTransactionId(decision, tx, amount),
      clientTransactionId: tx,
    })}`;

  return (
    <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
      <p className="flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-xs font-medium text-amber-900">
        <FlaskConicalIcon className="size-4" /> Modo de pruebas: no se realiza ningún cobro
      </p>
      <div className="mt-6 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-[#ff6d00] text-white">
          <CreditCardIcon className="size-5" />
        </span>
        <div>
          <p className="text-sm text-muted-foreground">Payphone (simulado)</p>
          <p className="font-medium">{reference}</p>
        </div>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">Total a pagar</p>
      <p className="text-3xl font-semibold tabular-nums" data-testid="mock-amount">
        {formatUSD(amount)}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button asChild size="lg" className="h-11">
          <a href={back("approved")}>Aprobar pago</a>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-11">
          <a href={back("canceled")}>Rechazar pago</a>
        </Button>
      </div>
    </div>
  );
}

export default function MockPaymentPage({ searchParams }: PageProps<"/pago-simulado">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-16">
      <Suspense fallback={<div className="h-80 w-full max-w-sm animate-pulse rounded-2xl bg-muted" />}>
        <MockGateway searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
