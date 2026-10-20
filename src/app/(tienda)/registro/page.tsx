import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard, AuthFormSkeleton } from "@/components/tienda/auth/auth-card";
import { RegisterForm } from "@/components/tienda/auth/auth-forms";
import { safeRedirect } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Crear cuenta",
  robots: { index: false },
};

async function RegisterFormWithParams({ searchParams }: Pick<PageProps<"/registro">, "searchParams">) {
  const { callbackUrl } = await searchParams;
  const safe = callbackUrl ? safeRedirect(callbackUrl, "/cuenta") : undefined;
  return <RegisterForm callbackUrl={safe} />;
}

export default function RegisterPage({ searchParams }: PageProps<"/registro">) {
  return (
    <AuthCard title="Crear cuenta" description="Guarda tus datos de envío y revisa el estado de tus pedidos.">
      <Suspense fallback={<AuthFormSkeleton />}>
        <RegisterFormWithParams searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
