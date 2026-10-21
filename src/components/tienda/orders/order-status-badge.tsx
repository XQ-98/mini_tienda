import { ORDER_STATUS_LABEL, type OrderStatusValue } from "@/lib/domain/order-status";
import { cn } from "@/lib/utils";

const TONE: Record<OrderStatusValue, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-900",
  PAID: "bg-emerald-100 text-emerald-900",
  SHIPPED: "bg-sky-100 text-sky-900",
  DELIVERED: "bg-emerald-700 text-white", // 600 no alcanza el contraste 4.5:1 de WCAG AA
  CANCELLED: "bg-muted text-muted-foreground",
};

export function OrderStatusBadge({ status, className }: { status: OrderStatusValue; className?: string }) {
  return (
    <span
      data-testid="order-status"
      className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", TONE[status], className)}
    >
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
