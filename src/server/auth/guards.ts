import "server-only";

import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { db } from "@/server/db";

export async function getSessionUser() {
  // auth() renueva y vuelve a cifrar el JWT (IV aleatorio): debe ejecutarse en la
  // petición real, no durante el prerenderizado.
  await connection();
  const session = await auth();
  return session?.user ?? null;
}

/** Exige sesión. Usar en páginas y en cada Server Action que lo necesite. */
export async function requireUser(callbackUrl = "/cuenta") {
  const user = await getSessionUser();
  if (!user) redirect(`/ingresar?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return user;
}

/**
 * Exige rol ADMIN consultando la base de datos, no solo el JWT: si a alguien
 * se le quita el rol, pierde el acceso de inmediato aunque su token siga vigente.
 */
export async function requireAdmin() {
  const user = await requireUser("/admin");
  const fresh = await db.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (fresh?.role !== "ADMIN") notFound();
  return user;
}
