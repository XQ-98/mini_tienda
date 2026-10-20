import type { Metadata } from "next";
import { Suspense } from "react";

import { DemoCredentials } from "@/components/demo-banner";
import { AuthCard, AuthFormSkeleton } from "@/components/tienda/auth/auth-card";
import { LoginForm } from "@/components/tienda/auth/auth-forms";
import { safeRedirect } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Ingresar",
  robots: { index: false },
};

async function LoginFormWithParams({ searchParams }: Pick<PageProps<"/ingresar">, "searchParams">) {
  const { callbackUrl } = await searchParams;
  // Se sanea aquí y otra vez en la Server Action (el campo oculto se puede manipular).
  const safe = callbackUrl ? safeRedirect(callbackUrl, "/cuenta") : undefined;
  return <LoginForm callbackUrl={safe} />;
}

export default function LoginPage({ searchParams }: PageProps<"/ingresar">) {
  return (
    <AuthCard title="Ingresar" description="Accede para seguir tus pedidos y comprar más rápido.">
      <DemoCredentials />
      <Suspense fallback={<AuthFormSkeleton />}>
        <LoginFormWithParams searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
