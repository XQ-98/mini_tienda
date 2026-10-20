// Máquina de estados del pedido. Cualquier cambio de estado pasa por
// canTransition(): así no existe, por ejemplo, un pedido "entregado" que nunca se pagó.

export const ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatusValue, readonly OrderStatusValue[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatusValue, to: OrderStatusValue): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: OrderStatusValue): readonly OrderStatusValue[] {
  return TRANSITIONS[from];
}

export const ORDER_STATUS_LABEL: Record<OrderStatusValue, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export const PAYMENT_STATUS_LABEL = {
  PENDING: "Pendiente",
  IN_REVIEW: "Comprobante en revisión",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  FAILED: "Fallido",
} as const;

export const PAYMENT_METHOD_LABEL = {
  PAYPHONE: "Tarjeta (Payphone)",
  BANK_TRANSFER: "Transferencia bancaria",
} as const;
