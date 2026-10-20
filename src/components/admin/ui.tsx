import type { ReactNode } from "react";

import { PAYMENT_STATUS_LABEL } from "@/lib/domain/order-status";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className, actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-heading text-lg font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const PAYMENT_TONE: Record<keyof typeof PAYMENT_STATUS_LABEL, string> = {
  PENDING: "bg-muted text-muted-foreground",
  IN_REVIEW: "bg-amber-100 text-amber-900",
  APPROVED: "bg-emerald-100 text-emerald-900",
  REJECTED: "bg-red-100 text-red-900",
  FAILED: "bg-muted text-muted-foreground",
};

export function PaymentStatusBadge({ status }: { status: keyof typeof PAYMENT_STATUS_LABEL }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", PAYMENT_TONE[status])}>
      {PAYMENT_STATUS_LABEL[status]}
    </span>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Cargando">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="h-72 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
