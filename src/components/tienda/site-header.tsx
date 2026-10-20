import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { getCategories } from "@/server/queries/catalog";
import { getStoreSettings } from "@/server/queries/settings";

import { HeaderActions, HeaderActionsView } from "./header-actions";
import { MobileNav } from "./mobile-nav";

export async function SiteHeader() {
  const [store, categories] = await Promise.all([getStoreSettings(), getCategories()]);
  const navCategories = categories.map((c) => ({ name: c.name, slug: c.slug }));

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <MobileNav storeName={store.storeName} categories={navCategories} />

        <Link href="/" className="shrink-0 font-heading text-xl font-semibold tracking-tight whitespace-nowrap sm:text-2xl">
          {store.logoUrl ? (
            <Image src={store.logoUrl} alt={store.storeName} width={140} height={40} className="h-9 w-auto object-contain" />
          ) : (
            store.storeName
          )}
        </Link>

        <nav aria-label="Principal" className="ml-6 hidden items-center gap-5 text-sm whitespace-nowrap xl:flex">
          <Link href="/productos" className="text-muted-foreground transition-colors hover:text-foreground">
            Todo
          </Link>
          {navCategories.slice(0, 4).map((c) => (
            <Link
              key={c.slug}
              href={`/categoria/${c.slug}`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {c.name}
            </Link>
          ))}
        </nav>

        <Form action="/productos" role="search" className="ml-auto hidden w-full max-w-xs md:block">
          <label className="relative block">
            <span className="sr-only">Buscar productos</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" type="search" placeholder="Buscar ponchos, sombreros…" className="h-9 pl-9" />
          </label>
        </Form>

        <div className="ml-auto md:ml-2">
          <Suspense fallback={<HeaderActionsView signedIn={false} count={0} />}>
            <HeaderActions />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
