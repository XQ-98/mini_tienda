import type { Metadata } from "next";

import { AdminMobileBar, AdminSidebar } from "@/components/admin/admin-nav";
import { DemoBanner } from "@/components/demo-banner";
import { getStoreSettings } from "@/server/queries/settings";

export const metadata: Metadata = {
  title: { default: "Administración", template: "%s · Administración" },
  robots: { index: false, follow: false },
};

// El layout solo dibuja la navegación. La verificación de rol NO vive aquí:
// cada página y cada acción llama a requireAdmin() junto a sus datos (un layout
// no impide que la página se renderice). El proxy agrega una primera barrera.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { storeName } = await getStoreSettings();
  return (
    <div className="flex min-h-svh bg-muted/30">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>

      <AdminSidebar storeName={storeName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <AdminMobileBar storeName={storeName} />
        <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
