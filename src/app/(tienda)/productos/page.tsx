import type { Metadata } from "next";
import { Suspense } from "react";

import { CatalogResults, CatalogSkeleton } from "@/components/tienda/catalog/catalog-results";

export const metadata: Metadata = {
  title: "Catálogo",
  description: "Ponchos, blusas bordadas, sombreros de paja toquilla y accesorios tejidos a mano en Ecuador.",
  alternates: { canonical: "/productos" },
};

export default function ProductsPage({ searchParams }: PageProps<"/productos">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Catálogo</h1>
        <p className="mt-2 text-muted-foreground">Todos nuestros productos, hechos a mano en Ecuador.</p>
      </header>

      {/* Los filtros viven en la URL: se leen al momento del request, dentro de Suspense */}
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogResults basePath="/productos" searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
