import { CheckIcon, XIcon } from "lucide-react";

import type { OrderStatusValue } from "@/lib/domain/order-status";
import { cn } from "@/lib/utils";

const STEPS: { status: OrderStatusValue; label: string }[] = [
  { status: "PENDING_PAYMENT", label: "Pedido recibido" },
  { status: "PAID", label: "Pago confirmado" },
  { status: "SHIPPED", label: "Enviado" },
  { status: "DELIVERED", label: "Entregado" },
];

export function OrderTimeline({ status }: { status: OrderStatusValue }) {
  if (status === "CANCELLED") {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm">
        <XIcon className="size-4" /> Este pedido fue cancelado.
      </p>
    );
  }
  const current = STEPS.findIndex((s) => s.status === status);

  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Estado del pedido">
      {STEPS.map((step, i) => {
        const done = i <= current;
        return (
          <li key={step.status} className="flex flex-col items-center text-center" aria-current={i === current ? "step" : undefined}>
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : done ? "bg-primary" : "bg-border")} />
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                  done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
                )}
              >
                {done ? <CheckIcon className="size-4" /> : i + 1}
              </span>
              <span
                className={cn("h-0.5 flex-1", i === STEPS.length - 1 ? "bg-transparent" : i < current ? "bg-primary" : "bg-border")}
              />
            </div>
            <span className={cn("mt-2 text-xs", done ? "font-medium" : "text-muted-foreground")}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
