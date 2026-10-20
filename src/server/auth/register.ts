import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

import { registerSchema } from "@/lib/validations/auth";
import { db } from "@/server/db";
import { hashPassword } from "@/server/security/password";

export type RegisterResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; fieldErrors: Record<string, string[] | undefined> };

/** Crea una cuenta de cliente. El rol siempre es CUSTOMER: nunca se toma del formulario. */
export async function registerUser(raw: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { name, email, phone, password } = parsed.data;

  try {
    const user = await db.user.create({
      data: { name, email, phone, passwordHash: await hashPassword(password), role: "CUSTOMER" },
      select: { id: true, email: true },
    });
    return { ok: true, userId: user.id, email: user.email };
  } catch (e) {
    // Correo ya registrado (también cubre dos registros simultáneos con el mismo correo)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, fieldErrors: { email: ["Ya existe una cuenta con este correo"] } };
    }
    throw e;
  }
}
