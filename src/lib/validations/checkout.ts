import { z } from "zod";

import { getProvince, isValidCanton } from "@/lib/data/ecuador";
import { CONSUMIDOR_FINAL_ID, validateEcId } from "@/lib/domain/ec-id";
import { emailSchema, nameSchema } from "@/lib/validations/auth";

// Esquema del checkout, compartido por el formulario (validación inmediata) y
// la Server Action (validación que cuenta). Llega como FormData plano.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .transform((v) => v || undefined);

// Razón social: letras, números y signos habituales (S.A., Cía. Ltda., &).
const billNamePattern = /^[\p{L}\p{M}\p{N} .,&'()-]+$/u;

export const checkoutSchema = z
  .object({
    shipName: nameSchema,
    shipPhone: z
      .string({ error: "Ingresa un celular" })
      .trim()
      .transform((v) => v.replace(/[\s-]/g, ""))
      .pipe(z.string().regex(/^09\d{8}$/, "Celular en formato 09XXXXXXXX")),
    shipProvince: z.string({ error: "Elige una provincia" }).refine((c) => !!getProvince(c), "Elige una provincia"),
    shipCity: z.string({ error: "Elige una ciudad" }).min(1, "Elige una ciudad"),
    shipAddress: z
      .string({ error: "Ingresa la dirección" })
      .trim()
      .min(8, "Escribe calle principal, número y calle secundaria")
      .max(200, "Máximo 200 caracteres"),
    shipReference: optionalText(200),
    billingType: z.enum(["consumidor_final", "datos"], { error: "Elige cómo quieres tu factura" }),
    billId: optionalText(13),
    billName: optionalText(150),
    billEmail: optionalText(254),
    paymentMethod: z.enum(["PAYPHONE", "BANK_TRANSFER"], { error: "Elige un método de pago" }),
  })
  .superRefine((d, ctx) => {
    if (getProvince(d.shipProvince) && !isValidCanton(d.shipProvince, d.shipCity)) {
      ctx.addIssue({ code: "custom", path: ["shipCity"], message: "Elige una ciudad de la provincia" });
    }
    if (d.billingType !== "datos") return;

    const id = validateEcId(d.billId ?? "");
    if (!id.valid) ctx.addIssue({ code: "custom", path: ["billId"], message: id.reason });

    if (!d.billName || d.billName.length < 3 || !billNamePattern.test(d.billName)) {
      ctx.addIssue({ code: "custom", path: ["billName"], message: "Ingresa el nombre o razón social" });
    }
    if (!emailSchema.safeParse(d.billEmail ?? "").success) {
      ctx.addIssue({ code: "custom", path: ["billEmail"], message: "Correo inválido" });
    }
  });

export type CheckoutFormInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;

export interface BillingData {
  idType: "CEDULA" | "RUC" | "CONSUMIDOR_FINAL";
  id: string;
  name: string;
  email: string;
}

/** Datos de facturación normalizados. Para consumidor final se usa el correo de la cuenta. */
export function toBilling(d: CheckoutData, accountEmail: string): BillingData {
  if (d.billingType === "consumidor_final") {
    return { idType: "CONSUMIDOR_FINAL", id: CONSUMIDOR_FINAL_ID, name: "CONSUMIDOR FINAL", email: accountEmail };
  }
  const id = validateEcId(d.billId!);
  return {
    idType: id.valid ? id.type : "CEDULA",
    id: d.billId!,
    name: d.billName!,
    email: emailSchema.parse(d.billEmail),
  };
}
