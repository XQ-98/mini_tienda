"use client";

import { useState, type ReactNode, useId } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { productSchema } from "@/lib/validations/admin";
import { issueMap } from "@/lib/validations/issues";
import { saveProductAction } from "@/server/actions/admin";

import { type ProductFormValues, type VariantRow } from "./product-form-values";
import { Card } from "./ui";
import { useAdminAction } from "./use-admin-action";



let rowCounter = 0;
const newKey = () => `row-${++rowCounter}`;

const blankVariant = (size: string): VariantRow => ({
  key: newKey(),
  sku: "",
  size,
  color: "",
  colorHex: "#888888",
  price: "",
  stock: "0",
  isActive: true,
});

const blankForm = (categories: { id: string }[]) => ({
  name: "",
  slug: "",
  description: "",
  categoryId: categories[0]?.id ?? "",
  price: "",
  compareAtPrice: "",
  isActive: true,
  isFeatured: false,
});

export function ProductForm({
  initial,
  categories,
}: {
  initial?: ProductFormValues;
  categories: { id: string; name: string }[];
}) {
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const isNew = !initial?.id;
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [form, setForm] = useState(() =>
    initial
      ? {
          name: initial.name,
          slug: initial.slug,
          description: initial.description,
          categoryId: initial.categoryId,
          price: initial.price,
          compareAtPrice: initial.compareAtPrice,
          isActive: initial.isActive,
          isFeatured: initial.isFeatured,
        }
      : blankForm(categories),
  );
  const [variants, setVariants] = useState<VariantRow[]>(() =>
    initial?.variants.length ? initial.variants.map((v) => ({ ...v, key: newKey() })) : [blankVariant("Única")],
  );

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setVariant = (key: string, patch: Partial<VariantRow>) =>
    setVariants((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function payload() {
    return {
      ...form,
      compareAtPrice: form.compareAtPrice || null,
      variants: variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        stock: v.stock,
        isActive: v.isActive,
        size: v.size || null,
        color: v.color || null,
        colorHex: v.color ? v.colorHex : null,
        price: v.price || null,
      })),
    };
  }

  function submit() {
    const data = payload();
    const check = productSchema.safeParse(data);
    if (!check.success) {
      setErrors(issueMap(check.error));
      toast.error("Revisa los campos marcados.");
      return;
    }
    setErrors({});
    run(async () => {
      const result = await saveProductAction(initial?.id ?? null, data);
      if (!result.ok && result.fieldErrors) setErrors(result.fieldErrors);
      if (result.ok && isNew && result.id) {
        // Next.js conserva esta página oculta (Activity): se limpia para que
        // "Nuevo producto" vuelva a empezar en blanco.
        setForm(blankForm(categories));
        setVariants([blankVariant("Única")]);
        setSlugTouched(false);
        router.push(`/admin/productos/${result.id}`);
      }
      return result;
    });
  }

  const err = (path: string) => errors[path]?.[0];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-6"
      noValidate
    >
      <Card title="Información">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor={fid("name")} error={err("name")} className="sm:col-span-2">
            <Input
              id={fid("name")}
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
              className="h-10"
            />
          </Field>
          <Field label="URL (slug)" htmlFor={fid("slug")} error={err("slug")} hint={`/productos/${form.slug || "…"}`}>
            <Input
              id={fid("slug")}
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value.toLowerCase());
              }}
              className="h-10 font-mono text-sm"
            />
          </Field>
          <Field label="Categoría" htmlFor={fid("categoryId")} error={err("categoryId")}>
            <select
              id={fid("categoryId")}
              value={form.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Descripción" htmlFor={fid("description")} error={err("description")} className="sm:col-span-2">
            <Textarea id={fid("description")} rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Precio (USD, IVA incluido)" htmlFor={fid("price")} error={err("price")}>
            <Input id={fid("price")} inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} className="h-10" />
          </Field>
          <Field label="Precio anterior (opcional, para mostrar descuento)" htmlFor={fid("compareAtPrice")} error={err("compareAtPrice")}>
            <Input
              id={fid("compareAtPrice")}
              inputMode="decimal"
              value={form.compareAtPrice}
              onChange={(e) => set("compareAtPrice", e.target.value)}
              className="h-10"
            />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} aria-label="Visible en la tienda" />
            Visible en la tienda
          </label>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={form.isFeatured} onCheckedChange={(v) => set("isFeatured", v)} aria-label="Destacado en el inicio" />
            Destacado en el inicio
          </label>
        </div>
      </Card>

      <Card
        title="Variantes y stock"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setVariants((rows) => [
                ...rows,
                blankVariant(""),
              ])
            }
          >
            <PlusIcon /> Agregar variante
          </Button>
        }
      >
        {err("variants") && <p className="mb-3 text-sm text-destructive">{err("variants")}</p>}
        <ul className="flex flex-col gap-3" data-testid="variant-rows">
          {variants.map((v, i) => (
            <li key={v.key} className={cn("grid gap-3 rounded-lg border p-3 sm:grid-cols-[repeat(6,minmax(0,1fr))_auto]", !v.isActive && "opacity-60")}>
              <Field label="SKU" error={err(`variants.${i}.sku`)} small>
                <Input value={v.sku} onChange={(e) => setVariant(v.key, { sku: e.target.value.toUpperCase() })} className="h-9 font-mono text-xs" aria-label={`SKU variante ${i + 1}`} />
              </Field>
              <Field label="Talla" error={err(`variants.${i}.size`)} small>
                <Input value={v.size} onChange={(e) => setVariant(v.key, { size: e.target.value })} placeholder="M, 57 cm, Única" className="h-9" aria-label={`Talla variante ${i + 1}`} />
              </Field>
              <Field label="Color" error={err(`variants.${i}.color`)} small>
                <div className="flex gap-1.5">
                  <input
                    type="color"
                    value={v.colorHex}
                    onChange={(e) => setVariant(v.key, { colorHex: e.target.value })}
                    className="h-9 w-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
                    aria-label={`Muestra de color variante ${i + 1}`}
                  />
                  <Input value={v.color} onChange={(e) => setVariant(v.key, { color: e.target.value })} className="h-9" aria-label={`Color variante ${i + 1}`} />
                </div>
              </Field>
              <Field label="Precio propio" error={err(`variants.${i}.price`)} small>
                <Input value={v.price} onChange={(e) => setVariant(v.key, { price: e.target.value })} inputMode="decimal" placeholder="Igual" className="h-9" aria-label={`Precio variante ${i + 1}`} />
              </Field>
              <Field label="Stock" error={err(`variants.${i}.stock`)} small>
                <Input value={v.stock} onChange={(e) => setVariant(v.key, { stock: e.target.value })} inputMode="numeric" className="h-9" aria-label={`Stock variante ${i + 1}`} />
              </Field>
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                Activa
                <Switch checked={v.isActive} onCheckedChange={(c) => setVariant(v.key, { isActive: c })} aria-label={`Variante ${i + 1} activa`} />
              </label>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={variants.length === 1}
                  onClick={() => setVariants((rows) => rows.filter((r) => r.key !== v.key))}
                  aria-label={`Quitar variante ${i + 1}`}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          El stock se descuenta automáticamente al confirmar cada pago. Una variante inactiva no se muestra en la tienda.
        </p>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <Button type="submit" size="lg" disabled={pending} className="h-11">
          {pending && <Loader2Icon className="animate-spin" />} {isNew ? "Crear producto" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  small,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  small?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className={small ? "text-xs text-muted-foreground" : undefined}>
        {label}
      </Label>
      {children}
      {hint && !error && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
