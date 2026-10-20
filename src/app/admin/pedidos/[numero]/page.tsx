import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AlertTriangleIcon, ChevronLeftIcon, FileTextIcon } from "lucide-react";

import { ConfirmReviewedButton, OrderStatusActions, PaymentReviewActions } from "@/components/admin/order-actions";
import { Card, PageSkeleton, PaymentStatusBadge } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/tienda/orders/order-status-badge";
import { formatUSD } from "@/lib/domain/money";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, nextStatuses } from "@/lib/domain/order-status";
import { adminOrder } from "@/server/admin/queries";

export const metadata = { title: "Pedido" };

const dateTime = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

async function OrderContent({ params }: Pick<PageProps<"/admin/pedidos/[numero]">, "params">) {
  const { numero } = await params;
  const number = Number(numero);
  if (!Number.isSafeInteger(number) || number <= 0) notFound();
  const order = await adminOrder(number);
  if (!order) notFound();

  const approvedButPending = order.status === "PENDING_PAYMENT" && order.payments.some((p) => p.status === "APPROVED");
  const allowed = nextStatuses(order.status).filter((s) => s !== "PAID");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Pedido #{order.number}</h1>
          <p className="text-sm text-muted-foreground">
            {dateTime.format(order.createdAt)} · {order.user.email}
          </p>
        </div>
        <OrderStatusBadge status={order.status} className="text-sm" />
      </div>

      {approvedButPending && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangleIcon className="size-5 shrink-0" />
          <p className="flex-1">
            El pago fue aprobado pero no se pudo confirmar el pedido (sin stock suficiente). Repón el stock y reintenta, o
            cancela el pedido y reembolsa el pago.
          </p>
          <ConfirmReviewedButton orderNumber={order.number} />
        </div>
      )}

      {allowed.length > 0 && (
        <Card title="Acciones">
          <OrderStatusActions orderNumber={order.number} status={order.status} allowed={allowed} />
        </Card>
      )}

      <Card title="Pagos">
        {order.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin intentos de pago todavía ({PAYMENT_METHOD_LABEL[order.paymentMethod]}).
          </p>
        ) : (
          <ul className="divide-y">
            {order.payments.map((p) => {
              const isPdf = p.proofStorageId?.endsWith(".pdf");
              return (
                <li key={p.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0" data-testid="admin-payment">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{PAYMENT_METHOD_LABEL[p.method]}</span>
                    <PaymentStatusBadge status={p.status} />
                    <span className="tabular-nums">{formatUSD(p.amount)}</span>
                    <span className="text-muted-foreground">· {dateTime.format(p.createdAt)}</span>
                  </div>
                  {p.providerTxId && <p className="text-xs text-muted-foreground">Transacción: {p.providerTxId}</p>}
                  {p.rejectionReason && <p className="text-sm text-destructive">Motivo del rechazo: {p.rejectionReason}</p>}
                  {p.proofStorageId &&
                    (isPdf ? (
                      <a
                        href={`/api/comprobantes/${p.id}`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex w-fit items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
                      >
                        <FileTextIcon className="size-4" /> Ver comprobante (PDF)
                      </a>
                    ) : (
                      <a href={`/api/comprobantes/${p.id}`} target="_blank" rel="noopener" className="block w-fit">
                        <Image
                          src={`/api/comprobantes/${p.id}`}
                          alt={`Comprobante del pedido ${order.number}`}
                          width={240}
                          height={320}
                          unoptimized
                          className="max-h-80 w-auto rounded-lg border object-contain"
                        />
                      </a>
                    ))}
                  {p.status === "IN_REVIEW" && order.status === "PENDING_PAYMENT" && (
                    <div className="rounded-lg bg-muted/60 p-3">
                      <p className="mb-2 text-sm">
                        Verifica en el banco que llegaron <strong>{formatUSD(order.total)}</strong> con la referencia{" "}
                        <strong>Pedido #{order.number}</strong>.
                      </p>
                      <PaymentReviewActions paymentId={p.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card title="Productos">
          <ul className="divide-y text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-2.5">
                <div>
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-muted-foreground">
                    {item.variantLabel} · SKU {item.sku} · {item.quantity} × {formatUSD(item.unitPrice)}
                  </p>
                </div>
                <p className="tabular-nums">{formatUSD(item.unitPrice * item.quantity)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Envío</dt>
              <dd className="tabular-nums">{formatUSD(order.shippingCost)}</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>Subtotal sin IVA</dt>
              <dd className="tabular-nums">{formatUSD(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>IVA {order.taxRateBps / 100}%</dt>
              <dd className="tabular-nums">{formatUSD(order.taxAmount)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatUSD(order.total)}</dd>
            </div>
          </dl>
        </Card>

        <div className="flex flex-col gap-6">
          <Card title="Envío">
            <div className="text-sm">
              <p className="font-medium">{order.shipName}</p>
              <p>{order.shipAddress}</p>
              {order.shipReference && <p className="text-muted-foreground">Ref.: {order.shipReference}</p>}
              <p>
                {order.shipCity}, {order.shipProvince}
              </p>
              <p>{order.shipPhone}</p>
              {order.trackingCode && <p className="mt-2 font-medium">Guía: {order.trackingCode}</p>}
            </div>
          </Card>
          <Card title="Datos para la factura">
            <dl className="space-y-1 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Identificación</dt>
                <dd>
                  {order.billIdType === "CONSUMIDOR_FINAL" ? "Consumidor final" : order.billIdType === "RUC" ? "RUC" : "Cédula"}{" "}
                  {order.billId}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Nombre / razón social</dt>
                <dd>{order.billName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Correo</dt>
                <dd>{order.billEmail}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <Card title="Historial">
        <ol className="relative space-y-4 border-l pl-5 text-sm" data-testid="order-events">
          {order.events.map((e) => (
            <li key={e.id}>
              <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-card bg-primary" />
              <p className="font-medium">{e.from === e.to ? "Nota" : ORDER_STATUS_LABEL[e.to]}</p>
              {e.note && <p className="text-muted-foreground">{e.note}</p>}
              <p className="text-xs text-muted-foreground">
                {dateTime.format(e.createdAt)}
                {e.actor && ` · ${e.actor.role === "ADMIN" ? "Admin" : "Cliente"}: ${e.actor.name}`}
              </p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

export default function AdminOrderPage({ params }: PageProps<"/admin/pedidos/[numero]">) {
  return (
    <>
      <Link href="/admin/pedidos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Pedidos
      </Link>
      <Suspense fallback={<PageSkeleton />}>
        <OrderContent params={params} />
      </Suspense>
    </>
  );
}
