import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { PlusIcon, SearchIcon, StarIcon } from "lucide-react";

import { AdminPagination } from "@/components/admin/pagination";
import { EmptyRow, PageHeader, PageSkeleton } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUSD } from "@/lib/domain/money";
import { adminCategories, adminProducts } from "@/server/admin/queries";

export const metadata = { title: "Productos" };

async function ProductsContent({ searchParams }: Pick<PageProps<"/admin/productos">, "searchParams">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const categoryId = typeof sp.categoria === "string" && /^[a-z0-9]{20,40}$/.test(sp.categoria) ? sp.categoria : undefined;
  const page = Math.max(1, Math.min(1000, Number(sp.pagina) || 1));

  const [{ products, total, pageCount }, categories] = await Promise.all([
    adminProducts({ q, categoryId, page }),
    adminCategories(),
  ]);
  const href = (p: number) =>
    `/admin/productos?${new URLSearchParams({ ...(q && { q }), ...(categoryId && { categoria: categoryId }), ...(p > 1 && { pagina: String(p) }) })}`;

  return (
    <>
      <Form action="/admin/productos" className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Buscar por nombre o SKU" className="h-10 pl-9" />
        </div>
        <select
          name="categoria"
          defaultValue={categoryId ?? ""}
          className="h-10 rounded-lg border border-input bg-card px-3 text-sm"
          aria-label="Categoría"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" className="h-10">
          Filtrar
        </Button>
      </Form>
      <p className="mb-2 text-sm text-muted-foreground">{total} producto(s)</p>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 text-right font-medium">Precio</th>
              <th className="px-4 py-3 text-right font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y" data-testid="admin-products">
            {products.length === 0 && <EmptyRow colSpan={5}>No hay productos con estos filtros.</EmptyRow>}
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-muted/50">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/productos/${p.id}`} className="flex items-center gap-3">
                    <span className="relative size-11 shrink-0 overflow-hidden rounded-md bg-muted">
                      {p.image && <Image src={p.image} alt="" fill sizes="44px" className="object-cover" />}
                    </span>
                    <span>
                      <span className="flex items-center gap-1 font-medium text-primary hover:underline">
                        {p.name}
                        {p.isFeatured && <StarIcon className="size-3.5 fill-current text-amber-500" aria-label="Destacado" />}
                      </span>
                      <span className="text-xs text-muted-foreground">{p.variantCount} variante(s)</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{p.category.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatUSD(p.price)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  <span className={p.stock === 0 ? "font-medium text-destructive" : undefined}>{p.stock}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={
                      p.isActive
                        ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900"
                        : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    }
                  >
                    {p.isActive ? "Visible" : "Oculto"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AdminPagination page={page} pageCount={pageCount} href={href} />
    </>
  );
}

export default function AdminProductsPage({ searchParams }: PageProps<"/admin/productos">) {
  return (
    <>
      <PageHeader
        title="Productos"
        actions={
          <Button asChild className="h-10">
            <Link href="/admin/productos/nuevo">
              <PlusIcon /> Nuevo producto
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <ProductsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
