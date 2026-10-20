import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeftIcon } from "lucide-react";

import { ProductForm } from "@/components/admin/product-form";
import { PageHeader, PageSkeleton } from "@/components/admin/ui";
import { adminCategories } from "@/server/admin/queries";

export const metadata = { title: "Nuevo producto" };

async function NewProduct() {
  const categories = await adminCategories();
  if (categories.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-6 text-sm">
        Primero crea una{" "}
        <Link href="/admin/categorias" className="text-primary underline">
          categoría
        </Link>
        .
      </p>
    );
  }
  return <ProductForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />;
}

export default function NewProductPage() {
  return (
    <>
      <Link href="/admin/productos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Productos
      </Link>
      <PageHeader title="Nuevo producto" description="Después de crearlo podrás subir sus imágenes." />
      <Suspense fallback={<PageSkeleton />}>
        <NewProduct />
      </Suspense>
    </>
  );
}
