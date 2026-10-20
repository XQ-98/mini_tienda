import Link from "next/link";
import { cacheLife } from "next/cache";
import { MailIcon, MapPinIcon, MessageCircleIcon } from "lucide-react";

import { getCategories } from "@/server/queries/catalog";
import { getStoreSettings } from "@/server/queries/settings";

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export async function SiteFooter() {
  const [store, categories] = await Promise.all([getStoreSettings(), getCategories()]);

  return (
    <footer className="mt-16 border-t bg-secondary/60">
      <div className="bg-andean h-6 opacity-70" aria-hidden />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-heading text-2xl font-semibold">{store.storeName}</p>
          {store.tagline && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{store.tagline}</p>}
          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
            {store.address && (
              <li className="flex items-start gap-2">
                <MapPinIcon className="mt-0.5 size-4 shrink-0" /> {store.address}
              </li>
            )}
            {store.contactEmail && (
              <li className="flex items-center gap-2">
                <MailIcon className="size-4 shrink-0" />
                <a href={`mailto:${store.contactEmail}`} className="hover:text-foreground">
                  {store.contactEmail}
                </a>
              </li>
            )}
            {store.whatsappNumber && (
              <li className="flex items-center gap-2">
                <MessageCircleIcon className="size-4 shrink-0" />
                <a
                  href={`https://wa.me/${store.whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  WhatsApp
                </a>
              </li>
            )}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold">Categorías</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/categoria/${c.slug}`} className="hover:text-foreground">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold">Compra segura</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Tarjeta de crédito o débito con Payphone</li>
            <li>Transferencia bancaria</li>
            <li>Envíos a las 24 provincias</li>
            <li>Precios con IVA incluido</li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          © <CurrentYear /> {store.storeName}. Hecho en Ecuador.
        </p>
      </div>
    </footer>
  );
}
