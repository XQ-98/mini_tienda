import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { SearchIcon } from "lucide-react";

import { AdminPagination } from "@/components/admin/pagination";
import { EmptyRow, PageHeader, PageSkeleton, PaymentStatusBadge } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/tienda/orders/order-status-badge";
import { Input } from "@/components/ui/input";
import { formatUSD } from "@/lib/domain/money";
import { cn } from "@/lib/utils";
import { ORDER_FILTERS, adminOrderCounts, adminOrders, type OrderFilter } from "@/server/admin/queries";

export const metadata = { title: "Pedidos" };

const dateTime = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

async function OrdersContent({ searchParams }: Pick<PageProps<"/admin/pedidos">, "searchParams">) {
  const sp = await searchParams;
  const filter = (typeof sp.filtro === "string" && sp.filtro in ORDER_FILTERS ? sp.filtro : "todos") as OrderFilter;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const page = Math.max(1, Math.min(1000, Number(sp.pagina) || 1));

  const [{ orders, pageCount }, counts] = await Promise.all([adminOrders({ filter, q, page }), adminOrderCounts()]);
  const href = (f: string, p = 1) => `/admin/pedidos?${new URLSearchParams({ filtro: f, ...(q && { q }), ...(p > 1 && { pagina: String(p) }) })}`;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filtrar pedidos" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {Object.entries(ORDER_FILTERS).map(([key, f]) => (
            <Link
              key={key}
              href={href(key)}
              aria-current={filter === key ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap",
                filter === key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
              )}
            >
              {f.label}
              <span className={cn("text-xs tabular-nums", filter === key ? "opacity-80" : "text-muted-foreground")}>
                {counts[key as OrderFilter]}
              </span>
            </Link>
          ))}
        </nav>
        <Form action="/admin/pedidos" className="relative w-full lg:w-72">
          <input type="hidden" name="filtro" value={filter} />
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="N.º, cliente, correo o cédula" className="h-10 pl-9" />
        </Form>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Pedido</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Pago</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y" data-testid="admin-orders">
            {orders.length === 0 && <EmptyRow colSpan={6}>No hay pedidos con este filtro.</EmptyRow>}
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-muted/50">
                <td className="px-4 py-3">
                  <Link href={`/admin/pedidos/${o.number}`} className="font-medium text-primary hover:underline">
                    #{o.number}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{dateTime.format(o.createdAt)}</td>
                <td className="px-4 py-3">
                  <p>{o.shipName}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.user.email} · {o.shipCity}
                  </p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatUSD(o.total)}</td>
                <td className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">{o.paymentMethod === "PAYPHONE" ? "Tarjeta" : "Transferencia"}</p>
                  {o.payments[0] && <PaymentStatusBadge status={o.payments[0].status} />}
                </td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={o.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AdminPagination page={page} pageCount={pageCount} href={(p) => href(filter, p)} />
    </>
  );
}

export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/pedidos">) {
  return (
    <>
      <PageHeader title="Pedidos" />
      <Suspense fallback={<PageSkeleton />}>
        <OrdersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
