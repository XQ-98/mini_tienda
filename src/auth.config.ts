import type { NextAuthConfig } from "next-auth";

// Configuración compartida entre el proxy y el servidor. No importa Prisma ni
// bcrypt: el proxy solo necesita leer el JWT de la sesión.
export const authConfig = {
  pages: { signIn: "/ingresar" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
