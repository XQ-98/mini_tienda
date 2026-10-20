import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getStoreSettings } from "@/server/queries/settings";

import { getDashboardData } from "./dashboard.service";

// Capa de acceso a datos del panel. CADA función verifica el rol de admin
// (consultando la BD) antes de leer: un layout no impide que una página se
// renderice, así que la verificación vive junto a los datos.

export const ADMIN_PAGE_SIZE = 20;

export async function adminDashboard() {
  await requireAdmin();
  const settings = await getStoreSettings();
  return getDashboardData(new Date(), settings.lowStockThreshold);
}

// ─── Pedidos ────────────────────────────────────────────────────────────────

export const ORDER_FILTERS = {
  todos: { label: "Todos", where: {} },
  "por-pagar": { label: "Por pagar", where: { status: "PENDING_PAYMENT" } },
  revision: { label: "Comprobantes", where: { payments: { some: { status: "IN_REVIEW" } } } },
  "por-enviar": { label: "Por enviar", where: { status: "PAID" } },
  enviados: { label: "Enviados", where: { status: "SHIPPED" } },
  entregados: { label: "Entregados", where: { status: "DELIVERED" } },
  cancelados: { label: "Cancelados", where: { status: "CANCELLED" } },
} satisfies Record<string, { label: string; where: Prisma.OrderWhereInput }>;

export type OrderFilter = keyof typeof ORDER_FILTERS;

export async function adminOrders(params: { filter: OrderFilter; q?: string; page: number }) {
  await requireAdmin();
  const q = params.q?.trim();
  const where: Prisma.OrderWhereInput = {
    ...ORDER_FILTERS[params.filter].where,
    ...(q && {
      OR: /^\d+$/.test(q)
        ? [{ number: Number(q) }, { shipPhone: { contains: q } }, { billId: { contains: q } }]
        : [
            { shipName: { contains: q, mode: "insensitive" } },
            { billName: { contains: q, mode: "insensitive" } },
            { user: { email: { contains: q, mode: "insensitive" } } },
          ],
    }),
  };

  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        createdAt: true,
        paymentMethod: true,
        shipName: true,
        shipCity: true,
        user: { select: { email: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
      },
    }),
  ]);
  return { orders, total, pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
}

export async function adminOrderCounts() {
  await requireAdmin();
  const entries = await Promise.all(
    Object.entries(ORDER_FILTERS).map(async ([key, f]) => [key, await db.order.count({ where: f.where })] as const),
  );
  return Object.fromEntries(entries) as Record<OrderFilter, number>;
}

export async function adminOrder(number: number) {
  await requireAdmin();
  const order = await db.order.findUnique({
    where: { number },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      items: { orderBy: { id: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) return null;

  // Nombres de quienes hicieron cada cambio (cliente o admin)
  const actorIds = [...new Set(order.events.flatMap((e) => (e.actorId ? [e.actorId] : [])))];
  const actors = await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, role: true } });
  const actorById = new Map(actors.map((a) => [a.id, a]));

  return {
    ...order,
    events: order.events.map((e) => ({ ...e, actor: e.actorId ? (actorById.get(e.actorId) ?? null) : null })),
  };
}

export type AdminOrder = NonNullable<Awaited<ReturnType<typeof adminOrder>>>;

// ─── Catálogo ───────────────────────────────────────────────────────────────

export async function adminProducts(params: { q?: string; categoryId?: string; page: number }) {
  await requireAdmin();
  const q = params.q?.trim();
  const where: Prisma.ProductWhereInput = {
    ...(params.categoryId && { categoryId: params.categoryId }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
      ],
    }),
  };
  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (params.page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        isActive: true,
        isFeatured: true,
        category: { select: { name: true } },
        images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
        variants: { select: { stock: true, isActive: true } },
      },
    }),
  ]);
  return {
    products: products.map(({ variants, images, ...p }) => ({
      ...p,
      image: images[0]?.url ?? null,
      variantCount: variants.length,
      stock: variants.filter((v) => v.isActive).reduce((n, v) => n + v.stock, 0),
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
  };
}

export async function adminProduct(id: string) {
  await requireAdmin();
  return db.product.findUnique({
    where: { id },
    include: {
      variants: { orderBy: { id: "asc" } },
      images: { orderBy: [{ position: "asc" }, { id: "asc" }] },
    },
  });
}

export async function adminCategories() {
  await requireAdmin();
  return db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
}

// ─── Configuración ──────────────────────────────────────────────────────────

export async function adminSettings() {
  await requireAdmin();
  const [settings, rates, accounts] = await Promise.all([
    db.storeSettings.findUnique({ where: { id: 1 } }),
    db.shippingRate.findMany({ orderBy: { provinceCode: "asc" } }),
    db.bankAccount.findMany({ orderBy: [{ sortOrder: "asc" }, { bankName: "asc" }] }),
  ]);
  return { settings, rates, accounts };
}
