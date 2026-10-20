"use client";

import Image from "next/image";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  images: { url: string; alt: string }[];
  index: number;
  onIndexChange: (index: number) => void;
}

export function ProductGallery({ images, index, onIndexChange }: Props) {
  if (images.length === 0) {
    return <div className="aspect-4/5 rounded-2xl bg-muted" />;
  }
  const current = images[index] ?? images[0];
  const go = (delta: number) => onIndexChange((index + delta + images.length) % images.length);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-4/5 overflow-hidden rounded-2xl bg-muted">
        <Image
          key={current.url}
          src={current.url}
          alt={current.alt}
          fill
          preload
          sizes="(min-width: 768px) 50vw, 100vw"
          className="animate-in object-cover fade-in-0 duration-300"
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Imagen anterior"
              className="absolute top-1/2 left-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur hover:bg-background"
            >
              <ChevronLeftIcon className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Imagen siguiente"
              className="absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur hover:bg-background"
            >
              <ChevronRightIcon className="size-5" />
            </button>
            <p className="absolute right-3 bottom-3 rounded-full bg-background/80 px-2.5 py-0.5 text-xs tabular-nums backdrop-blur">
              {index + 1} / {images.length}
            </p>
          </>
        )}
      </div>

      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Miniaturas">
          {images.map((img, i) => (
            <li key={img.url} className="shrink-0">
              <button
                type="button"
                onClick={() => onIndexChange(i)}
                aria-label={`Ver imagen ${i + 1}: ${img.alt}`}
                aria-current={i === index}
                className={cn(
                  "relative block size-16 overflow-hidden rounded-lg border-2 bg-muted transition sm:size-20",
                  i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
