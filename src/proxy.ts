import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PROTECTED = ["/cuenta", "/checkout", "/admin"];
const AUTH_PAGES = ["/ingresar", "/registro"];

const matches = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Primera barrera de acceso: redirige antes de renderizar.
 * No es la única: los layouts y las Server Actions vuelven a verificar la
 * sesión y el rol (defensa en profundidad, ver src/server/auth/guards.ts).
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const user = req.auth?.user;

  if (matches(pathname, PROTECTED) && !user) {
    const login = new URL("/ingresar", req.nextUrl);
    login.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(login);
  }

  if (matches(pathname, ["/admin"]) && user?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  if (matches(pathname, AUTH_PAGES) && user) {
    return NextResponse.redirect(new URL("/cuenta", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/cuenta/:path*", "/checkout/:path*", "/admin/:path*", "/ingresar", "/registro"],
};
