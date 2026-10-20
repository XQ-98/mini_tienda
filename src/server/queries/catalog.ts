import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZE, type CatalogFilters } from "@/lib/validations/catalog";
import { dollarsToCents } from "@/lib/domain/money";
import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";

// ─── Tarjeta de producto ────────────────────────────────────────────────────

const productCardSelect = {
  id: true,
  name: true,
  slug: true,
  price: true,
  compareAtPrice: true,
  category: { select: { name: true, slug: true } },
  images: { select: { url: true, alt: true }, orderBy: { position: "asc" }, take: 1 },
  variants: { where: { isActive: true }, select: { stock: true, color: true, colorHex: true } },
} satisfies Prisma.ProductSelect;

type ProductCardRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice: number | null;
  category: { name: string; slug: string };
  image: { url: string; alt: string } | null;
  colors: { name: string; hex: string }[];
  inStock: boolean;
}

function toCard(row: ProductCardRow): ProductCardData {
  const colors = new Map<string, string>();
  for (const v of row.variants) {
    if (v.color && v.colorHex) colors.set(v.color, v.colorHex);
  }
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: row.price,
    compareAtPrice: row.compareAtPrice,
    category: row.category,
    image: row.images[0] ?? null,
    colors: [...colors].map(([name, hex]) => ({ name, hex })),
    inStock: row.variants.some((v) => v.stock > 0),
  };
}

// ─── Consultas ──────────────────────────────────────────────────────────────

export async function getCategories() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.categories);

  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });
  return categories.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
}

export async function getCategoryBySlug(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.categories);

  return db.category.findFirst({
    where: { slug, isActive: true },
    select: { id: true, name: true, slug: true, description: true, imageUrl: true },
  });
}

export async function getFeaturedProducts(limit = 8): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.products);

  const rows = await db.product.findMany({
    where: { isActive: true, isFeatured: true, category: { isActive: true } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: productCardSelect,
  });
  return rows.map(toCard);
}

const ORDER_BY: Record<CatalogFilters["orden"], Prisma.ProductOrderByWithRelationInput[]> = {
  recientes: [{ createdAt: "desc" }, { id: "asc" }],
  "precio-asc": [{ price: "asc" }, { id: "asc" }],
  "precio-desc": [{ price: "desc" }, { id: "asc" }],
  nombre: [{ name: "asc" }, { id: "asc" }],
};

export interface CatalogPage {
  products: ProductCardData[];
  total: number;
  page: number;
  pageCount: number;
}

/**
 * Página del catálogo con búsqueda, filtros y orden. Los filtros forman parte
 * de la clave de caché, así que cada combinación se cachea por separado.
 */
export async function getCatalogPage(filters: CatalogFilters): Promise<CatalogPage> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.products);

  const { q, categoria, min, max, orden, pagina } = filters;

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    category: { isActive: true, ...(categoria && { slug: categoria }) },
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { category: { name: { contains: q, mode: "insensitive" } } },
      ],
    }),
    ...((min !== undefined || max !== undefined) && {
      price: {
        ...(min !== undefined && { gte: dollarsToCents(min) }),
        ...(max !== undefined && { lte: dollarsToCents(max) }),
      },
    }),
  };

  const total = await db.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pagina, pageCount);

  const rows = await db.product.findMany({
    where,
    orderBy: ORDER_BY[orden],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: productCardSelect,
  });

  return { products: rows.map(toCard), total, page, pageCount };
}

// ─── Ficha de producto ──────────────────────────────────────────────────────

export const productTag = (slug: string) => `product:${slug}`;

export async function getProductBySlug(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.products, productTag(slug));

  const product = await db.product.findFirst({
    where: { slug, isActive: true, category: { isActive: true } },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      price: true,
      compareAtPrice: true,
      category: { select: { id: true, name: true, slug: true } },
      images: { select: { url: true, alt: true, color: true }, orderBy: { position: "asc" } },
      variants: {
        where: { isActive: true },
        // cuid empieza con un timestamp: ordenar por id respeta el orden de creación
        orderBy: { id: "asc" },
        select: { id: true, sku: true, size: true, color: true, colorHex: true, price: true, stock: true },
      },
    },
  });
  if (!product) return null;

  return {
    ...product,
    // Precio efectivo de cada variante (puede sobrescribir el del producto)
    variants: product.variants.map((v) => ({ ...v, price: v.price ?? product.price })),
  };
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

export async function getRelatedProducts(categoryId: string, excludeId: string, limit = 4) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.products);

  const rows = await db.product.findMany({
    where: { categoryId, isActive: true, id: { not: excludeId } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: productCardSelect,
  });
  return rows.map(toCard);
}

export async function getProductSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.products);

  const rows = await db.product.findMany({ where: { isActive: true }, select: { slug: true } });
  return rows.map((r) => r.slug);
}

// ─── SEO ────────────────────────────────────────────────────────────────────

/** Datos para el sitemap: solo lo visible en la tienda. */
export async function getSitemapData() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.products, TAGS.categories);

  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { isActive: true, category: { isActive: true } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
  ]);
  return { products, categories };
}
