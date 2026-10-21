"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ExternalLinkIcon,
  FolderTreeIcon,
  LayoutDashboardIcon,
  MenuIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingBagIcon,
} from "lucide-react";

import { LogoutButton } from "@/components/tienda/auth/logout-button";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Mismo aspecto que las opciones del menú
const LOGOUT_CLASS = "justify-start gap-3 px-3 font-normal text-muted-foreground";

const NAV = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboardIcon, exact: true },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingBagIcon },
  { href: "/admin/productos", label: "Productos", icon: PackageIcon },
  { href: "/admin/categorias", label: "Categorías", icon: FolderTreeIcon },
  { href: "/admin/configuracion", label: "Configuración", icon: SettingsIcon },
];

// usePathname() lee la URL: en rutas dinámicas debe ir dentro de <Suspense>.
// Mientras tanto se muestra el menú sin resaltar ninguna opción.
function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavList pathname="" onNavigate={onNavigate} />}>
      <ActiveNavLinks onNavigate={onNavigate} />
    </Suspense>
  );
}

function ActiveNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} />;
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Administración" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" /> {label}
          </Link>
        );
      })}
      <Link
        href="/"
        target="_blank"
        className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ExternalLinkIcon className="size-4" /> Ver tienda
      </Link>
    </nav>
  );
}

export function AdminSidebar({ storeName }: { storeName: string }) {
  return (
    <div className="hidden w-60 shrink-0 border-r bg-sidebar lg:block">
      <aside className="sticky top-0 flex h-svh flex-col p-4">
      <Link href="/admin" className="mb-6 px-3">
        <span className="block font-heading text-lg font-semibold">{storeName}</span>
        <span className="text-xs text-muted-foreground">Panel de administración</span>
      </Link>
      <NavLinks />
      <div className="mt-auto border-t pt-4">
        <LogoutButton className={LOGOUT_CLASS} />
      </div>
      </aside>
    </div>
  );
}

export function AdminMobileBar({ storeName }: { storeName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon-lg" aria-label="Abrir menú" className="-ml-2">
            <MenuIcon className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader>
            <SheetTitle className="font-heading">{storeName}</SheetTitle>
          </SheetHeader>
          <div className="px-4">
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="mt-4 border-t pt-4">
              <LogoutButton className={LOGOUT_CLASS} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <span className="font-heading font-semibold">Administración</span>
    </header>
  );
}
