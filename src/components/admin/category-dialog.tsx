"use client";

import { useState, useId } from "react";
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/slug";
import { deleteCategoryAction, saveCategoryAction } from "@/server/actions/admin";

import { useAdminAction } from "./use-admin-action";

interface CategoryValues {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export function CategoryDialog({ category, nextOrder }: { category?: CategoryValues; nextOrder?: number }) {
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!category);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const { pending, run } = useAdminAction();

  function submit(formData: FormData) {
    run(async () => {
      const result = await saveCategoryAction(category?.id ?? null, formData);
      if (!result.ok) setErrors(result.fieldErrors ?? {});
      return result;
    }, () => setOpen(false));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {category ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${category.name}`}>
            <PencilIcon />
          </Button>
        ) : (
          <Button className="h-10">
            <PlusIcon /> Nueva categoría
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fid("cat-name")}>Nombre</Label>
            <Input
              id={fid("cat-name")}
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
            {errors.name?.[0] && <p className="text-xs text-destructive">{errors.name[0]}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fid("cat-slug")}>URL (slug)</Label>
            <Input
              id={fid("cat-slug")}
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">/categoria/{slug || "…"}</p>
            {errors.slug?.[0] && <p className="text-xs text-destructive">{errors.slug[0]}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fid("cat-description")}>Descripción (opcional)</Label>
            <Textarea id={fid("cat-description")} name="description" rows={2} defaultValue={category?.description ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={fid("cat-order")}>Orden</Label>
              <Input id={fid("cat-order")} name="sortOrder" type="number" min={0} defaultValue={category?.sortOrder ?? nextOrder ?? 0} />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={category?.isActive ?? true} className="size-4 accent-primary" />
              Visible
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fid("cat-image")}>Imagen (opcional)</Label>
            <Input id={fid("cat-image")} name="image" type="file" accept="image/jpeg,image/png,image/webp" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteCategoryButton({ id, name, disabled }: { id: string; name: string; disabled: boolean }) {
  const { pending, run } = useAdminAction();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={disabled || pending}
      title={disabled ? "Tiene productos: muévelos antes de eliminarla" : undefined}
      aria-label={`Eliminar ${name}`}
      className="text-muted-foreground hover:text-destructive"
      onClick={() => confirm(`¿Eliminar la categoría "${name}"?`) && run(() => deleteCategoryAction(id))}
    >
      <Trash2Icon />
    </Button>
  );
}
