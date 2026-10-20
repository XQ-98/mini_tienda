import { z } from "zod";

const encoder = new TextEncoder();

export const emailSchema = z
  .string({ error: "Ingresa tu correo" })
  .trim()
  .toLowerCase()
  .min(1, "Ingresa tu correo")
  .max(254, "Correo demasiado largo")
  .pipe(z.email("Correo inválido"));

/**
 * Política de contraseñas. bcrypt solo usa los primeros 72 bytes: si se
 * permitieran más, dos contraseñas distintas con el mismo prefijo serían
 * equivalentes. Se mide en bytes UTF-8 (una "ñ" ocupa 2).
 */
export const passwordSchema = z
  .string({ error: "Ingresa una contraseña" })
  .min(8, "Mínimo 8 caracteres")
  .refine((p) => encoder.encode(p).length <= 72, "Máximo 72 bytes")
  .refine((p) => /\p{L}/u.test(p), "Debe incluir al menos una letra")
  .refine((p) => /\d/.test(p), "Debe incluir al menos un número");

// Letras (con tildes), espacios, apóstrofo, punto y guion. Nada de < > " ni controles.
export const nameSchema = z
  .string({ error: "Ingresa tu nombre" })
  .trim()
  .min(2, "Ingresa tu nombre completo")
  .max(80, "Nombre demasiado largo")
  .regex(/^[\p{L}\p{M}' .-]+$/u, "El nombre solo puede tener letras");

// Celular ecuatoriano: 09XXXXXXXX. Opcional.
const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.union([z.literal(""), z.string().regex(/^09\d{8}$/, "Formato: 09XXXXXXXX")]))
  .optional()
  .transform((v) => v || undefined);

export const loginSchema = z.object({
  email: emailSchema,
  // En login no se aplica la política (cuentas antiguas), solo un límite de tamaño.
  password: z.string({ error: "Ingresa tu contraseña" }).min(1, "Ingresa tu contraseña").max(200),
});

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
