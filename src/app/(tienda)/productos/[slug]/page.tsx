import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRightIcon, CreditCardIcon, TruckIcon } from "lucide-react";

import { ProductView } from "@/components/tienda/product/product-view";
import { ProductGrid, ProductGridSkeleton } from "@/components/tienda/product-grid";
import { formatUSD } from "@/lib/domain/money";
import { JsonLd, breadcrumbJsonLd, productJsonLd } from "@/lib/seo/json-ld";
import { getSiteUrl } from "@/lib/site";
import { getProductBySlug, getProductSlugs, getRelatedProducts } from "@/server/queries/catalog";
import { getStoreSettings } from "@/server/queries/settings";

export async function generateStaticParams() {
  const slugs = await getProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/productos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [product, store] = await Promise.all([getProductBySlug(slug), getStoreSettings()]);
  if (!product) return { title: "Producto no encontrado" };

  const description = product.description.slice(0, 160);
  return {
    title: product.name,
    description,
    alternates: { canonical: `/productos/${product.slug}` },
    // La imagen la genera opengraph-image.tsx (PNG con foto, nombre y precio)
    openGraph: { title: product.name, description, type: "website", siteName: store.storeName, locale: "es_EC" },
  };
}

async function ProductContent({ params }: Pick<PageProps<"/productos/[slug]">, "params">) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getStoreSettings()]);
  if (!product) notFound();
  const site = getSiteUrl();

  return (
    <>
      <JsonLd
        data={[
          productJsonLd(site, settings.storeName, product),
          breadcrumbJsonLd(site, [
            { name: "Inicio", path: "/" },
            { name: product.category.name, path: `/categoria/${product.category.slug}` },
            { name: product.name, path: `/productos/${product.slug}` },
          ]),
        ]}
      />
      <nav aria-label="Ruta de navegación" className="mb-6 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Inicio
        </Link>
        <ChevronRightIcon className="size-3.5" />
        <Link href={`/categoria/${product.category.slug}`} className="hover:text-foreground">
          {product.category.name}
        </Link>
        <ChevronRightIcon className="size-3.5" />
        <span className="line-clamp-1 text-foreground">{product.name}</span>
      </nav>

      <ProductView
        product={product}
        lowStockThreshold={settings.lowStockThreshold}
        header={
          <>
            <Link
              href={`/categoria/${product.category.slug}`}
              className="text-xs tracking-widest text-muted-foreground uppercase hover:text-foreground"
            >
              {product.category.name}
            </Link>
            <h1 className="mt-2 font-heading text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
              {product.name}
            </h1>
          </>
        }
      >
        <ul className="mt-8 space-y-3 rounded-xl border bg-card p-4 text-sm">
          <li className="flex gap-3">
            <TruckIcon className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              Envío a todo el Ecuador.
              {settings.freeShippingFrom && ` Gratis en compras desde ${formatUSD(settings.freeShippingFrom)}.`}
            </span>
          </li>
          <li className="flex gap-3">
            <CreditCardIcon className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>Paga con tarjeta de crédito o débito (Payphone) o por transferencia bancaria.</span>
          </li>
        </ul>

        <section className="mt-8">
          <h2 className="font-heading text-xl font-semibold">Descripción</h2>
          <p className="mt-3 leading-relaxed whitespace-pre-line text-muted-foreground">{product.description}</p>
        </section>
      </ProductView>

      <Suspense fallback={<ProductGridSkeleton count={4} className="mt-16" />}>
        <RelatedProducts categoryId={product.category.id} productId={product.id} />
      </Suspense>
    </>
  );
}

async function RelatedProducts({ categoryId, productId }: { categoryId: string; productId: string }) {
  const related = await getRelatedProducts(categoryId, productId);
  if (related.length === 0) return null;
  return (
    <section className="mt-20">
      <h2 className="font-heading text-2xl font-semibold tracking-tight">También te puede gustar</h2>
      <ProductGrid products={related} className="mt-6" />
    </section>
  );
}

function ProductSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-12" aria-busy aria-label="Cargando producto">
      <div className="aspect-4/5 animate-pulse rounded-2xl bg-muted" />
      <div className="space-y-4">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-10 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-8 w-24 animate-pulse rounded bg-muted" />
        <div className="h-11 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

export default function ProductPage({ params }: PageProps<"/productos/[slug]">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <Suspense fallback={<ProductSkeleton />}>
        <ProductContent params={params} />
      </Suspense>
    </div>
  );
}
