import { z } from "zod";

import { getProvince } from "@/lib/data/ecuador";
import { validateEcId } from "@/lib/domain/ec-id";
import { dollarsToCents } from "@/lib/domain/money";
import { ORDER_STATUSES } from "@/lib/domain/order-status";
import { SLUG_PATTERN } from "@/lib/slug";
import { emailSchema } from "@/lib/validations/auth";
import { idSchema } from "@/lib/validations/cart";

// Esquemas del panel de administración. Los montos se ingresan en dólares y
// se guardan en centavos.

const dollars = z.coerce
  .number({ error: "Monto inválido" })
  .min(0, "No puede ser negativo")
  .max(100_000, "Monto demasiado alto")
  .transform((v) => dollarsToCents(v));

const optionalDollars = z
  .union([z.literal(""), z.null(), z.undefined(), dollars])
  .transform((v) => (typeof v === "number" ? v : null));

const text = (min: number, max: number, label: string) =>
  z
    .string({ error: `Ingresa ${label}` })
    .trim()
    .min(min, min > 1 ? `Mínimo ${min} caracteres` : `Ingresa ${label}`)
    .max(max, `Máximo ${max} caracteres`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .nullish()
    .transform((v) => v || null);

const slug = z.string().trim().max(80).regex(SLUG_PATTERN, "Solo minúsculas, números y guiones");

// ─── Productos ──────────────────────────────────────────────────────────────

export const variantSchema = z.object({
  id: idSchema.optional(),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,40}$/, "SKU: letras, números y guiones (3-40)"),
  size: optionalText(20),
  color: optionalText(30),
  colorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color en formato #RRGGBB")
    .nullish()
    .transform((v) => v?.toUpperCase() ?? null),
  price: optionalDollars,
  stock: z.coerce.number().int("Stock entero").min(0, "Stock no puede ser negativo").max(100_000),
  isActive: z.boolean(),
});

export const productSchema = z
  .object({
    name: text(3, 120, "el nombre"),
    slug,
    description: text(10, 5000, "la descripción"),
    categoryId: idSchema,
    price: dollars.refine((v) => v > 0, "El precio debe ser mayor a 0"),
    compareAtPrice: optionalDollars,
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    variants: z.array(variantSchema).min(1, "Agrega al menos una variante").max(100),
  })
  .superRefine((p, ctx) => {
    if (p.compareAtPrice !== null && p.compareAtPrice <= p.price) {
      ctx.addIssue({ code: "custom", path: ["compareAtPrice"], message: "El precio anterior debe ser mayor al actual" });
    }
    const combos = new Set<string>();
    const skus = new Set<string>();
    p.variants.forEach((v, i) => {
      const combo = `${v.size ?? ""}|${v.color ?? ""}`;
      if (combos.has(combo)) {
        ctx.addIssue({ code: "custom", path: ["variants", i, "size"], message: "Talla y color repetidos" });
      }
      if (skus.has(v.sku)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "SKU repetido" });
      combos.add(combo);
      skus.add(v.sku);
    });
  });

export type ProductInput = z.output<typeof productSchema>;

export const imageMetaSchema = z.object({
  alt: text(3, 160, "el texto alternativo"),
  color: optionalText(30),
});

// ─── Categorías ─────────────────────────────────────────────────────────────

export const categorySchema = z.object({
  name: text(2, 60, "el nombre"),
  slug,
  description: optionalText(300),
  sortOrder: z.coerce.number().int().min(0).max(1000),
  isActive: z.boolean(),
});

export type CategoryInput = z.output<typeof categorySchema>;

// ─── Pedidos ────────────────────────────────────────────────────────────────

export const orderTransitionSchema = z.object({
  orderNumber: z.coerce.number().int().positive(),
  to: z.enum(ORDER_STATUSES),
  trackingCode: optionalText(60),
  note: optionalText(300),
});

export const rejectPaymentSchema = z.object({
  paymentId: idSchema,
  reason: text(5, 300, "el motivo"),
});

// ─── Configuración ──────────────────────────────────────────────────────────

export const settingsSchema = z.object({
  storeName: text(2, 60, "el nombre de la tienda"),
  tagline: optionalText(160),
  whatsappNumber: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s+-]/g, ""))
    .pipe(z.string().regex(/^5939\d{8}$/, "Formato internacional: 5939XXXXXXXX")),
  contactEmail: emailSchema,
  address: optionalText(200),
  // 15 → 1500 puntos básicos
  taxRatePercent: z.coerce
    .number()
    .min(0)
    .max(30)
    .transform((v) => Math.round(v * 100)),
  lowStockThreshold: z.coerce.number().int().min(0).max(1000),
  freeShippingFrom: optionalDollars,
});

export const shippingRatesSchema = z
  .array(
    z.object({
      provinceCode: z.string().refine((c) => !!getProvince(c), "Provincia inválida"),
      cost: dollars,
      estimatedDays: text(1, 40, "el tiempo de entrega"),
    }),
  )
  .max(24);

export const bankAccountSchema = z.object({
  id: idSchema.optional(),
  bankName: text(3, 60, "el banco"),
  accountType: z.enum(["Ahorros", "Corriente"]),
  accountNumber: z.string().trim().regex(/^\d{6,20}$/, "Solo números (6 a 20 dígitos)"),
  holderName: text(3, 100, "el titular"),
  holderId: z
    .string()
    .trim()
    .refine((v) => validateEcId(v).valid, "Cédula o RUC inválido"),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(100),
});
