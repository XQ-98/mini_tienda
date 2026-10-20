import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, CreditCardIcon, HandHeartIcon, TruckIcon } from "lucide-react";

import { CategoryCard } from "@/components/tienda/category-card";
import { ProductGrid } from "@/components/tienda/product-grid";
import { Button } from "@/components/ui/button";
import { formatUSD } from "@/lib/domain/money";
import { JsonLd, absoluteUrl } from "@/lib/seo/json-ld";
import { getSiteUrl } from "@/lib/site";
import { getCategories, getFeaturedProducts } from "@/server/queries/catalog";
import { getStoreSettings } from "@/server/queries/settings";

export default async function HomePage() {
  const [store, categories, featured] = await Promise.all([
    getStoreSettings(),
    getCategories(),
    getFeaturedProducts(8),
  ]);
  const heroImages = featured.slice(0, 3).flatMap((p) => (p.image ? [p.image] : []));
  const site = getSiteUrl();

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: store.storeName,
            url: site,
            inLanguage: "es-EC",
            // Cuadro de búsqueda de la tienda directamente en Google
            potentialAction: {
              "@type": "SearchAction",
              target: `${site}/productos?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "ClothingStore",
            name: store.storeName,
            description: store.tagline ?? undefined,
            url: site,
            ...(store.logoUrl && { logo: absoluteUrl(site, store.logoUrl) }),
            ...(store.contactEmail && { email: store.contactEmail }),
            ...(store.whatsappNumber && { telephone: `+${store.whatsappNumber}` }),
            currenciesAccepted: "USD",
            paymentAccepted: "Tarjeta de crédito, tarjeta de débito, transferencia bancaria",
            address: {
              "@type": "PostalAddress",
              streetAddress: store.address ?? undefined,
              addressCountry: "EC",
            },
          },
        ]}
      />
      {/* Hero */}
      <section className="relative overflow-hidden bg-secondary/60">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-sm font-medium tracking-widest text-primary uppercase">Hecho a mano en Otavalo</p>
            <h1 className="mt-3 font-heading text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Tejidos que cuentan historias
            </h1>
            <p className="mt-5 max-w-md text-base text-muted-foreground sm:text-lg">
              Ponchos de alpaca, blusas bordadas y sombreros de paja toquilla, hechos por artesanos ecuatorianos y
              enviados a todo el país.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link href="/productos">
                  Ver catálogo <ArrowRightIcon />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
                <Link href="/categoria/sombreros">Sombreros de paja toquilla</Link>
              </Button>
            </div>
          </div>

          {/* En celular: tira compacta de 3 imágenes. En escritorio: una grande y dos apiladas. */}
          {heroImages.length === 3 && (
            <div className="grid grid-cols-3 gap-3 sm:gap-4 md:grid-cols-2" aria-hidden>
              {heroImages.map((img, i) => (
                <div
                  key={img.url}
                  className={
                    i === 0
                      ? "relative aspect-4/5 overflow-hidden rounded-2xl shadow-sm md:row-span-2 md:aspect-auto"
                      : "relative aspect-4/5 overflow-hidden rounded-2xl shadow-sm"
                  }
                >
                  <Image
                    src={img.url}
                    alt=""
                    fill
                    preload={i === 0}
                    sizes="(min-width: 768px) 25vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-andean h-6" aria-hidden />
      </section>

      {/* Beneficios */}
      <section aria-label="Beneficios" className="border-b">
        <ul className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm sm:grid-cols-3 sm:px-6">
          <Benefit icon={<TruckIcon />} title="Envíos a todo el Ecuador">
            {store.freeShippingFrom
              ? `Gratis en compras desde ${formatUSD(store.freeShippingFrom)}.`
              : "Llegamos a las 24 provincias."}
          </Benefit>
          <Benefit icon={<CreditCardIcon />} title="Pago seguro">
            Tarjeta con Payphone o transferencia bancaria.
          </Benefit>
          <Benefit icon={<HandHeartIcon />} title="Comercio justo">
            Trabajamos directamente con talleres artesanales.
          </Benefit>
        </ul>
      </section>

      {/* Categorías */}
      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
        <SectionHeader title="Compra por categoría" href="/productos" linkLabel="Ver todo" />
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {categories.map((c) => (
            <li key={c.id}>
              <CategoryCard category={c} />
            </li>
          ))}
        </ul>
      </section>

      {/* Destacados */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <SectionHeader title="Favoritos de la temporada" href="/productos" linkLabel="Ver catálogo" />
        <ProductGrid products={featured} className="mt-6" />
      </section>
    </>
  );
}

function SectionHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
        {linkLabel} <ArrowRightIcon className="size-4" />
      </Link>
    </div>
  );
}

function Benefit({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-5">
        {icon}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
