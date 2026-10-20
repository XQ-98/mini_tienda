import "server-only";

import type { OrderStatus } from "@/generated/prisma/client";
import { ecuadorDateKey, ecuadorDayStart, ecuadorMonthStart, lastDays } from "@/lib/domain/dates";
import { db } from "@/server/db";

// Un pedido cuenta como venta desde que se confirma su pago. Si luego se
// cancela, deja de contar.
const SOLD: OrderStatus[] = ["PAID", "SHIPPED", "DELIVERED"];

export async function getDashboardData(now: Date, lowStockThreshold: number) {
  const dayStart = ecuadorDayStart(now);
  const monthStart = ecuadorMonthStart(now);
  const days = lastDays(now, 30);
  const since = ecuadorDayStart(new Date(`${days[0]}T12:00:00-05:00`));

  const [today, month, pendingPayment, proofsInReview, needsReview, toShip, lowStock, lowStockCount, recent, paid] =
    await Promise.all([
      db.order.aggregate({ where: { status: { in: SOLD }, paidAt: { gte: dayStart } }, _sum: { total: true }, _count: true }),
      db.order.aggregate({ where: { status: { in: SOLD }, paidAt: { gte: monthStart } }, _sum: { total: true }, _count: true }),
      db.order.count({ where: { status: "PENDING_PAYMENT" } }),
      db.payment.count({ where: { status: "IN_REVIEW" } }),
      db.order.count({ where: { status: "PENDING_PAYMENT", payments: { some: { status: "APPROVED" } } } }),
      db.order.count({ where: { status: "PAID" } }),
      db.productVariant.findMany({
        where: { isActive: true, product: { isActive: true }, stock: { lte: lowStockThreshold } },
        orderBy: [{ stock: "asc" }, { sku: "asc" }],
        take: 8,
        select: {
          id: true,
          sku: true,
          size: true,
          color: true,
          stock: true,
          product: { select: { id: true, name: true } },
        },
      }),
      db.productVariant.count({
        where: { isActive: true, product: { isActive: true }, stock: { lte: lowStockThreshold } },
      }),
      db.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { number: true, status: true, total: true, createdAt: true, shipName: true },
      }),
      db.order.findMany({
        where: { status: { in: SOLD }, paidAt: { gte: since } },
        select: { paidAt: true, total: true },
      }),
    ]);

  const byDay = new Map(days.map((d) => [d, 0]));
  for (const o of paid) {
    const key = ecuadorDateKey(o.paidAt!);
    if (byDay.has(key)) byDay.set(key, byDay.get(key)! + o.total);
  }

  return {
    salesToday: { total: today._sum.total ?? 0, orders: today._count },
    salesMonth: { total: month._sum.total ?? 0, orders: month._count },
    pendingPayment,
    proofsInReview,
    needsReview,
    toShip,
    lowStock,
    lowStockCount,
    recent,
    daily: [...byDay].map(([date, total]) => ({ date, total })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
