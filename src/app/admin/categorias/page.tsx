import Image from "next/image";
import { Suspense } from "react";

import { CategoryDialog, DeleteCategoryButton } from "@/components/admin/category-dialog";
import { EmptyRow, PageHeader, PageSkeleton } from "@/components/admin/ui";
import { adminCategories } from "@/server/admin/queries";

export const metadata = { title: "Categorías" };

async function CategoriesContent() {
  const categories = await adminCategories();
  const nextOrder = Math.max(-1, ...categories.map((c) => c.sortOrder)) + 1;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <CategoryDialog nextOrder={nextOrder} />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">URL</th>
              <th className="px-4 py-3 text-right font-medium">Productos</th>
              <th className="px-4 py-3 text-right font-medium">Orden</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y" data-testid="admin-categories">
            {categories.length === 0 && <EmptyRow colSpan={6}>Aún no hay categorías.</EmptyRow>}
            {categories.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-3">
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                      {c.imageUrl && <Image src={c.imageUrl} alt="" fill sizes="40px" className="object-cover" />}
                    </span>
                    <span className="font-medium">{c.name}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">/categoria/{c.slug}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c._count.products}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c.sortOrder}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={
                      c.isActive
                        ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900"
                        : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    }
                  >
                    {c.isActive ? "Visible" : "Oculta"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <CategoryDialog category={c} />
                  <DeleteCategoryButton id={c.id} name={c.name} disabled={c._count.products > 0} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AdminCategoriesPage() {
  return (
    <>
      <PageHeader title="Categorías" description="Una categoría con productos no se puede eliminar: primero mueve sus productos." />
      <Suspense fallback={<PageSkeleton />}>
        <CategoriesContent />
      </Suspense>
    </>
  );
}
