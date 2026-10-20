import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PackageIcon, ShieldIcon } from "lucide-react";

import { LogoutButton } from "@/components/tienda/auth/logout-button";
import { OrderStatusBadge } from "@/components/tienda/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import { formatUSD } from "@/lib/domain/money";
import { requireUser } from "@/server/auth/guards";
import { getUserOrders } from "@/server/queries/orders";

const dateFormat = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "America/Guayaquil" });

export const metadata: Metadata = {
  title: "Mi cuenta",
  robots: { index: false },
};

async function AccountContent() {
  // El proxy ya redirige a los visitantes sin sesión; esta es la segunda verificación.
  const user = await requireUser("/cuenta");
  const orders = await getUserOrders(user.id);

  return (
    <div className="grid gap-6 md:grid-cols-[18rem_1fr]">
      <section className="h-fit rounded-xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">Sesión iniciada como</p>
        <p className="mt-1 font-semibold" data-testid="account-name">
          {user.name}
        </p>
        <p className="text-sm text-muted-foreground">{user.email}</p>

        {user.role === "ADMIN" && (
          <Button asChild variant="outline" className="mt-4 h-10 w-full">
            <Link href="/admin">
              <ShieldIcon /> Panel de administración
            </Link>
          </Button>
        )}

        <div className="mt-4">
          <LogoutButton />
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-heading text-xl font-semibold">Mis pedidos</h2>
        {orders.length === 0 ? (
          <div className="mt-6 flex flex-col items-center py-8 text-center">
            <PackageIcon className="size-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Aún no tienes pedidos.</p>
            <Button asChild className="mt-4 h-10">
              <Link href="/productos">Ir al catálogo</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-3 divide-y" data-testid="order-list">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/cuenta/pedidos/${o.number}`}
                  className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-muted"
                >
                  <div>
                    <p className="font-medium">Pedido #{o.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateFormat.format(o.createdAt)} · {o._count.items} {o._count.items === 1 ? "producto" : "productos"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums">{formatUSD(o.total)}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Mi cuenta</h1>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
        <AccountContent />
      </Suspense>
    </div>
  );
}
