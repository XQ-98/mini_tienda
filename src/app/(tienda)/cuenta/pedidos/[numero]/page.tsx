import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeftIcon } from "lucide-react";

import { OrderStatusBadge } from "@/components/tienda/orders/order-status-badge";
import { OrderTimeline } from "@/components/tienda/orders/order-timeline";
import { PaymentPanel } from "@/components/tienda/orders/payment-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatUSD } from "@/lib/domain/money";
import { PAYMENT_METHOD_LABEL } from "@/lib/domain/order-status";
import { requireUser } from "@/server/auth/guards";
import { getUserOrder } from "@/server/queries/orders";

export const metadata: Metadata = {
  title: "Detalle del pedido",
  robots: { index: false },
};

const PAYMENT_MESSAGES: Record<string, { tone: "success" | "error" | "info"; text: string }> = {
  aprobado: { tone: "success", text: "¡Pago aprobado! Estamos preparando tu pedido." },
  rechazado: { tone: "error", text: "El pago no se completó. Puedes intentarlo de nuevo o pagar por transferencia." },
  cancelado: { tone: "info", text: "Cancelaste el pago. Tu pedido sigue reservado." },
  pendiente: { tone: "info", text: "Payphone aún está procesando el pago. Revisa en unos minutos." },
  revision: { tone: "info", text: "Recibimos tu pago y estamos revisando el pedido. Te contactaremos pronto." },
  error: { tone: "error", text: "No pudimos verificar el pago. Si se debitó de tu tarjeta, escríbenos por WhatsApp." },
};

const dateFormat = new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeStyle: "short", timeZone: "America/Guayaquil" });

async function OrderDetail({ params, searchParams }: PageProps<"/cuenta/pedidos/[numero]">) {
  const [{ numero }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/cuenta/pedidos/${numero}`);

  const number = Number(numero);
  if (!Number.isSafeInteger(number) || number <= 0) notFound();
  // Filtra por usuario: un pedido ajeno responde 404, igual que uno inexistente
  const order = await getUserOrder(user.id, number);
  if (!order) notFound();

  const message = typeof query.pago === "string" ? PAYMENT_MESSAGES[query.pago] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Pedido #{order.number}</h1>
          <p className="text-sm text-muted-foreground">{dateFormat.format(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} className="text-sm" />
      </div>

      {query.nuevo === "1" && (
        <Alert data-testid="order-created">
          <AlertDescription>¡Gracias por tu compra! Registramos tu pedido.</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert variant={message.tone === "error" ? "destructive" : "default"} data-testid="payment-message">
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <OrderTimeline status={order.status} />

      <PaymentPanel order={order} />

      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">Productos</h2>
        <ul className="mt-3 divide-y">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
              <div>
                <p className="font-medium">{item.productName}</p>
                <p className="text-muted-foreground">
                  {item.variantLabel} · {item.quantity} × {formatUSD(item.unitPrice)}
                </p>
              </div>
              <p className="tabular-nums">{formatUSD(item.unitPrice * item.quantity)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1.5 border-t pt-4 text-sm">
          <Row label="Productos" value={formatUSD(order.total - order.shippingCost)} />
          <Row label="Envío" value={order.shippingCost === 0 ? "Gratis" : formatUSD(order.shippingCost)} />
          <Row label="Subtotal sin IVA" value={formatUSD(order.subtotal)} muted />
          <Row label={`IVA ${order.taxRateBps / 100}%`} value={formatUSD(order.taxAmount)} muted />
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums" data-testid="order-total">
              {formatUSD(order.total)}
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 text-sm">
          <h2 className="mb-2 font-heading text-lg font-semibold">Envío</h2>
          <p className="font-medium">{order.shipName}</p>
          <p className="text-muted-foreground">{order.shipAddress}</p>
          {order.shipReference && <p className="text-muted-foreground">Ref.: {order.shipReference}</p>}
          <p className="text-muted-foreground">
            {order.shipCity}, {order.shipProvince}
          </p>
          <p className="text-muted-foreground">{order.shipPhone}</p>
          {order.trackingCode && <p className="mt-2">Guía: {order.trackingCode}</p>}
        </section>
        <section className="rounded-xl border bg-card p-5 text-sm">
          <h2 className="mb-2 font-heading text-lg font-semibold">Factura y pago</h2>
          <p className="font-medium">{order.billName}</p>
          {order.billIdType !== "CONSUMIDOR_FINAL" && (
            <p className="text-muted-foreground">
              {order.billIdType === "RUC" ? "RUC" : "Cédula"} {order.billId}
            </p>
          )}
          <p className="text-muted-foreground">{order.billEmail}</p>
          <p className="mt-2">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</p>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={muted ? "flex justify-between text-xs text-muted-foreground" : "flex justify-between"}>
      <dt className={muted ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export default function OrderPage(props: PageProps<"/cuenta/pedidos/[numero]">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/cuenta" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Mis pedidos
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" aria-busy aria-label="Cargando pedido" />}>
        <OrderDetail {...props} />
      </Suspense>
    </div>
  );
}
