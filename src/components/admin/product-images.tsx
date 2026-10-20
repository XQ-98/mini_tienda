"use client";

import { useRef, useState, useId } from "react";
import Image from "next/image";
import { ArrowLeftIcon, ArrowRightIcon, ImagePlusIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteProductAction,
  deleteProductImageAction,
  moveProductImageAction,
  updateProductImageAction,
  uploadProductImagesAction,
} from "@/server/actions/admin";

import { Card } from "./ui";
import { useAdminAction } from "./use-admin-action";

interface ImageItem {
  id: string;
  url: string;
  alt: string;
  color: string | null;
}

export function ProductImages({ productId, images, colors }: { productId: string; images: ImageItem[]; colors: string[] }) {
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const { pending, run } = useAdminAction();
  const [uploading, setUploading] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Una imagen por petición: el límite de las Server Actions es de 6 MB por envío.
  async function upload(files: FileList) {
    const list = [...files];
    let ok = 0;
    for (const [i, file] of list.entries()) {
      setUploading(`Subiendo ${i + 1} de ${list.length}…`);
      const fd = new FormData();
      fd.append("images", file);
      const result = await uploadProductImagesAction(productId, fd);
      if (result.ok) ok++;
      else toast.error(result.error);
    }
    setUploading(null);
    if (ok) toast.success(`${ok} imagen(es) subida(s).`);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Card
      title="Imágenes"
      actions={
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id={fid("product-images")}
            onChange={(e) => e.target.files?.length && upload(e.target.files)}
          />
          <Button asChild variant="outline" size="sm" disabled={!!uploading}>
            <label htmlFor={fid("product-images")} className="cursor-pointer">
              {uploading ? <Loader2Icon className="animate-spin" /> : <ImagePlusIcon />}
              {uploading ?? "Subir imágenes"}
            </label>
          </Button>
        </>
      }
    >
      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          Sin imágenes. Sube fotos JPG, PNG o WEBP de hasta 5 MB.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="product-images">
          {images.map((img, i) => (
            <li key={img.id} className="flex flex-col gap-2 rounded-lg border p-2">
              <div className="relative aspect-4/5 overflow-hidden rounded-md bg-muted">
                <Image src={img.url} alt={img.alt} fill sizes="200px" className="object-cover" />
                {i === 0 && (
                  <span className="absolute top-1.5 left-1.5 rounded-full bg-foreground/80 px-2 py-0.5 text-[11px] text-background">
                    Portada
                  </span>
                )}
              </div>
              <Input
                defaultValue={img.alt}
                aria-label="Texto alternativo"
                className="h-8 text-xs"
                onBlur={(e) => {
                  const alt = e.target.value.trim();
                  if (alt !== img.alt) run(() => updateProductImageAction(img.id, { alt, color: img.color }));
                }}
              />
              {colors.length > 0 && (
                <select
                  defaultValue={img.color ?? ""}
                  aria-label="Color asociado"
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                  onChange={(e) => run(() => updateProductImageAction(img.id, { alt: img.alt, color: e.target.value || null }))}
                >
                  <option value="">Todos los colores</option>
                  {colors.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex justify-between">
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending || i === 0}
                    onClick={() => run(() => moveProductImageAction(img.id, "up"))}
                    aria-label="Mover antes"
                  >
                    <ArrowLeftIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending || i === images.length - 1}
                    onClick={() => run(() => moveProductImageAction(img.id, "down"))}
                    aria-label="Mover después"
                  >
                    <ArrowRightIcon />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  onClick={() => confirm("¿Eliminar esta imagen?") && run(() => deleteProductImageAction(img.id))}
                  aria-label="Eliminar imagen"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2Icon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function DeleteProductButton({ productId, name }: { productId: string; name: string }) {
  const { pending, run } = useAdminAction();
  return (
    <Button
      variant="outline"
      className="text-destructive"
      disabled={pending}
      onClick={() => {
        if (confirm(`¿Eliminar "${name}"? Los pedidos existentes conservan su información.`)) {
          run(() => deleteProductAction(productId));
        }
      }}
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />} Eliminar producto
    </Button>
  );
}
