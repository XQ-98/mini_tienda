import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/auth.config";
import { clientIp } from "@/lib/security/client-ip";
import { verifyCredentials } from "@/server/auth/credentials";

// El "code" viaja al cliente: solo distingue "credenciales inválidas" de
// "demasiados intentos", nunca si el correo existe o no.
class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}
class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      // Toda la lógica de seguridad está aquí y no en la Server Action de login,
      // porque Auth.js también expone POST /api/auth/callback/credentials:
      // un atacante podría llamarlo directamente y saltarse la acción.
      async authorize(credentials, request) {
        const result = await verifyCredentials(credentials, clientIp(request.headers));
        if (result.ok) return result.user;
        throw result.reason === "rate_limited" ? new TooManyAttempts() : new InvalidCredentials();
      },
    }),
  ],
});
