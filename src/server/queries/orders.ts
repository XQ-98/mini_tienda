import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";

export async function getShippingRates() {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.shipping);

  const rates = await db.shippingRate.findMany({ orderBy: { provinceCode: "asc" } });
  return Object.fromEntries(rates.map((r) => [r.provinceCode, { cost: r.cost, estimatedDays: r.estimatedDays }]));
}

export async function getBankAccounts() {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.settings);

  return db.bankAccount.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, bankName: true, accountType: true, accountNumber: true, holderName: true, holderId: true },
  });
}

// Las consultas de pedidos SIEMPRE filtran por userId: un cliente que cambia
// el número en la URL (/cuenta/pedidos/1002) no puede ver pedidos ajenos.

export async function getUserOrders(userId: string) {
  return db.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });
}

export async function getUserOrder(userId: string, number: number) {
  return db.order.findFirst({
    where: { userId, number },
    include: {
      items: { orderBy: { id: "asc" } },
      payments: {
        orderBy: { createdAt: "desc" },
        select: { id: true, method: true, status: true, amount: true, proofStorageId: true, rejectionReason: true, createdAt: true },
      },
      events: { orderBy: { createdAt: "asc" }, select: { id: true, to: true, note: true, createdAt: true } },
    },
  });
}

export type UserOrder = NonNullable<Awaited<ReturnType<typeof getUserOrder>>>;

/** Dirección del último pedido, para prellenar el checkout. */
export async function getLastShipping(userId: string) {
  return db.order.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { shipName: true, shipPhone: true, shipProvince: true, shipCity: true, shipAddress: true, shipReference: true },
  });
}
