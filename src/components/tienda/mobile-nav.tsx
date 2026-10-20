"use client";

import { useState } from "react";
import Form from "next/form";
import Link from "next/link";
import { MenuIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface Props {
  storeName: string;
  categories: { name: string; slug: string }[];
}

export function MobileNav({ storeName, categories }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="-ml-2 xl:hidden" aria-label="Abrir menú">
          <MenuIcon className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 max-w-[85vw]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle className="font-heading text-xl">{storeName}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          <Form action="/productos" role="search" onSubmit={close}>
            <label className="relative block">
              <span className="sr-only">Buscar productos</span>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" type="search" placeholder="Buscar productos…" className="h-11 pl-9 text-base" />
            </label>
          </Form>

          <nav aria-label="Categorías" className="flex flex-col">
            <Link href="/productos" onClick={close} className="border-b py-3 font-medium">
              Ver todo
            </Link>
            {categories.map((c) => (
              <Link key={c.slug} href={`/categoria/${c.slug}`} onClick={close} className="border-b py-3">
                {c.name}
              </Link>
            ))}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
