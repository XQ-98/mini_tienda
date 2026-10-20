import { DemoBanner } from "@/components/demo-banner";
import { SiteFooter } from "@/components/tienda/site-footer";
import { SiteHeader } from "@/components/tienda/site-header";
import { WhatsAppButton } from "@/components/tienda/whatsapp-button";
import { WhatsAppVisibility } from "@/components/tienda/whatsapp-visibility";

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <DemoBanner />
      <SiteHeader />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <WhatsAppVisibility>
        <WhatsAppButton />
      </WhatsAppVisibility>
    </>
  );
}
