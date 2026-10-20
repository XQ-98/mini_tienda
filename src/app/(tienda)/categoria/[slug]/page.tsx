import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRightIcon } from "lucide-react";

import { CatalogResults, CatalogSkeleton } from "@/components/tienda/catalog/catalog-results";
import { JsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { getSiteUrl } from "@/lib/site";
import { getCategories, getCategoryBySlug } from "@/server/queries/catalog";
import { getStoreSettings } from "@/server/queries/settings";

// Se prerenderizan las categorías existentes; las nuevas se generan al primer visita.
export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/categoria/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [category, store] = await Promise.all([getCategoryBySlug(slug), getStoreSettings()]);
  if (!category) return { title: "Categoría no encontrada" };

  return {
    title: category.name,
    description: category.description ?? undefined,
    alternates: { canonical: `/categoria/${category.slug}` },
    // openGraph reemplaza (no combina) al del layout: se repite la imagen de la tienda
    openGraph: {
      title: category.name,
      description: category.description ?? undefined,
      images: ["/opengraph-image"],
      siteName: store.storeName,
      locale: "es_EC",
    },
  };
}

async function CategoryHeader({ params }: Pick<PageProps<"/categoria/[slug]">, "params">) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <header className="mb-6">
      <JsonLd
        data={breadcrumbJsonLd(getSiteUrl(), [
          { name: "Inicio", path: "/" },
          { name: "Catálogo", path: "/productos" },
          { name: category.name, path: `/categoria/${category.slug}` },
        ])}
      />
      <nav aria-label="Ruta de navegación" className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Inicio
        </Link>
        <ChevronRightIcon className="size-3.5" />
        <Link href="/productos" className="hover:text-foreground">
          Catálogo
        </Link>
        <ChevronRightIcon className="size-3.5" />
        <span className="text-foreground">{category.name}</span>
      </nav>
      <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{category.name}</h1>
      {category.description && <p className="mt-2 max-w-2xl text-muted-foreground">{category.description}</p>}
    </header>
  );
}

async function CategoryCatalog({ params, searchParams }: PageProps<"/categoria/[slug]">) {
  const { slug } = await params;
  return <CatalogResults basePath={`/categoria/${slug}`} searchParams={searchParams} categorySlug={slug} />;
}

export default function CategoryPage(props: PageProps<"/categoria/[slug]">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Suspense
        fallback={
          <div className="mb-6 space-y-3">
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            <div className="h-9 w-64 animate-pulse rounded bg-muted" />
          </div>
        }
      >
        <CategoryHeader params={props.params} />
      </Suspense>
      <Suspense fallback={<CatalogSkeleton />}>
        <CategoryCatalog {...props} />
      </Suspense>
    </div>
  );
}
