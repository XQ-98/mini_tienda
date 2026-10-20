"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CredentialsSignin } from "next-auth";
import { z } from "zod";

import { signIn, signOut } from "@/auth";
import { safeRedirect } from "@/lib/safe-redirect";
import { clientIp } from "@/lib/security/client-ip";
import { loginSchema } from "@/lib/validations/auth";
import { registerUser } from "@/server/auth/register";
import { attachGuestCartToUser, readGuestCartId } from "@/server/cart/cart-session";
import { db } from "@/server/db";
import { LIMITS, consumeRateLimit } from "@/server/security/rate-limit";

export interface AuthFormState {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
}

const MESSAGES = {
  // Mismo mensaje si el correo no existe o si la contraseña es incorrecta.
  invalid: "Correo o contraseña incorrectos.",
  rateLimited: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
};

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

/** Inicia sesión con Auth.js y mueve el carrito de invitado a la cuenta. */
async function signInAndAttachCart(email: string, password: string): Promise<AuthFormState | null> {
  const guestCartId = await readGuestCartId();
  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (e) {
    if (e instanceof CredentialsSignin) {
      return { error: e.code === "rate_limited" ? MESSAGES.rateLimited : MESSAGES.invalid };
    }
    throw e;
  }
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (user) await attachGuestCartToUser(user.id, guestCartId);
  return null;
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData, "email");
  const parsed = loginSchema.safeParse({ email, password: text(formData, "password") });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: { email } };
  }

  const failure = await signInAndAttachCart(parsed.data.email, parsed.data.password);
  if (failure) return { ...failure, values: { email } };

  redirect(safeRedirect(formData.get("callbackUrl"), "/cuenta"));
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { name: text(formData, "name"), email: text(formData, "email"), phone: text(formData, "phone") };

  const ip = clientIp(await headers());
  const limit = await consumeRateLimit(`register:ip:${ip}`, LIMITS.registerPerIp);
  if (!limit.allowed) return { error: MESSAGES.rateLimited, values };

  const result = await registerUser({
    ...values,
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  });
  if (!result.ok) return { fieldErrors: result.fieldErrors, values };

  const failure = await signInAndAttachCart(result.email, text(formData, "password"));
  if (failure) return { ...failure, values };

  redirect(safeRedirect(formData.get("callbackUrl"), "/cuenta"));
}

/**
 * Cierra la sesión sin redirigir: el cliente hace una recarga completa
 * (window.location). Next.js conserva páginas visitadas ocultas en el DOM
 * (Activity); una navegación normal dejaría ahí datos de la cuenta, visibles
 * con "atrás" en un dispositivo compartido.
 */
export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
}
