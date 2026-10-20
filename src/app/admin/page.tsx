import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangleIcon, ChevronRightIcon } from "lucide-react";

import { Card, PageHeader, PageSkeleton } from "@/components/admin/ui";
import { SalesChart } from "@/components/admin/sales-chart";
import { OrderStatusBadge } from "@/components/tienda/orders/order-status-badge";
import { formatUSD } from "@/lib/domain/money";
import { variantLabel } from "@/lib/domain/variants";
import { adminDashboard } from "@/server/admin/queries";

export const metadata = { title: "Resumen" };

const dateTime = new Intl.DateTimeFormat("es-EC", { dateStyle: "short", timeStyle: "short", timeZone: "America/Guayaquil" });

function Stat({ label, value, detail, href }: { label: string; value: string; detail?: string; href?: string }) {
  const content = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
      {content}
    </Link>
  ) : (
    <div className="rounded-xl border bg-card p-4">{content}</div>
  );
}

async function Dashboard() {
  const d = await adminDashboard();

  return (
    <div className="flex flex-col gap-6">
      {d.needsReview > 0 && (
        <Link
          href="/admin/pedidos?filtro=por-pagar"
          className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <AlertTriangleIcon className="size-5 shrink-0" />
          <span>
            <strong>{d.needsReview} pedido(s)</strong> con pago recibido que no se pudieron confirmar (sin stock). Revísalos.
          </span>
          <ChevronRightIcon className="ml-auto size-4" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" data-testid="dashboard-stats">
        <Stat label="Ventas de hoy" value={formatUSD(d.salesToday.total)} detail={`${d.salesToday.orders} pedido(s)`} />
        <Stat label="Ventas del mes" value={formatUSD(d.salesMonth.total)} detail={`${d.salesMonth.orders} pedido(s)`} />
        <Stat label="Por enviar" value={String(d.toShip)} detail="Pagados, listos para despachar" href="/admin/pedidos?filtro=por-enviar" />
        <Stat label="Comprobantes por revisar" value={String(d.proofsInReview)} href="/admin/pedidos?filtro=revision" />
        <Stat label="Pendientes de pago" value={String(d.pendingPayment)} href="/admin/pedidos?filtro=por-pagar" />
        <Stat label="Variantes con poco stock" value={String(d.lowStockCount)} href="/admin/productos" />
      </div>

      <Card>
        <SalesChart data={d.daily} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Pedidos recientes" actions={<Link href="/admin/pedidos" className="text-sm text-primary hover:underline">Ver todos</Link>}>
          {d.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay pedidos.</p>
          ) : (
            <ul className="divide-y">
              {d.recent.map((o) => (
                <li key={o.number}>
                  <Link href={`/admin/pedidos/${o.number}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">#{o.number} · {o.shipName}</p>
                      <p className="text-xs text-muted-foreground">{dateTime.format(o.createdAt)}</p>
                    </div>
                    <span className="text-sm tabular-nums">{formatUSD(o.total)}</span>
                    <OrderStatusBadge status={o.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Poco stock">
          {d.lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todo el inventario está sobre el umbral.</p>
          ) : (
            <ul className="divide-y" data-testid="low-stock">
              {d.lowStock.map((v) => (
                <li key={v.id}>
                  <Link href={`/admin/productos/${v.product.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{v.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {variantLabel(v)} · {v.sku}
                      </p>
                    </div>
                    <span
                      className={
                        v.stock === 0
                          ? "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900"
                          : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                      }
                    >
                      {v.stock === 0 ? "Agotado" : `${v.stock} u.`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function AdminHomePage() {
  return (
    <>
      <PageHeader title="Resumen" description="Ventas en hora de Ecuador. Un pedido cuenta como venta cuando se confirma su pago." />
      <Suspense fallback={<PageSkeleton />}>
        <Dashboard />
      </Suspense>
    </>
  );
}
