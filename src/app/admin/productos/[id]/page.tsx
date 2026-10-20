import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeftIcon, ExternalLinkIcon } from "lucide-react";

import { ProductForm } from "@/components/admin/product-form";
import { productToForm } from "@/components/admin/product-form-values";
import { DeleteProductButton, ProductImages } from "@/components/admin/product-images";
import { PageHeader, PageSkeleton } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { adminCategories, adminProduct } from "@/server/admin/queries";

export const metadata = { title: "Editar producto" };

async function EditProduct({ params }: Pick<PageProps<"/admin/productos/[id]">, "params">) {
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/.test(id)) notFound();
  const [product, categories] = await Promise.all([adminProduct(id), adminCategories()]);
  if (!product) notFound();

  const colors = [...new Set(product.variants.flatMap((v) => (v.color ? [v.color] : [])))];

  return (
    <>
      <PageHeader
        title={product.name}
        actions={
          <Button asChild variant="outline" className="h-10">
            <Link href={`/productos/${product.slug}`} target="_blank">
              <ExternalLinkIcon /> Ver en la tienda
            </Link>
          </Button>
        }
      />
      <div className="flex flex-col gap-6">
        <ProductImages productId={product.id} images={product.images} colors={colors} />
        {/* key: al guardar, el formulario se reinicia con los datos actualizados */}
        <ProductForm
          key={product.updatedAt.toISOString()}
          initial={productToForm(product)}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
        <div className="flex justify-end">
          <DeleteProductButton productId={product.id} name={product.name} />
        </div>
      </div>
    </>
  );
}

export default function EditProductPage({ params }: PageProps<"/admin/productos/[id]">) {
  return (
    <>
      <Link href="/admin/productos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Productos
      </Link>
      <Suspense fallback={<PageSkeleton />}>
        <EditProduct params={params} />
      </Suspense>
    </>
  );
}
