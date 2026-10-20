"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Envuelve el panel de filtros en un sheet para pantallas pequeñas. */
export function MobileFilters({ children, activeCount }: { children: ReactNode; activeCount: number }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-10 lg:hidden">
          <SlidersHorizontalIcon />
          Filtros
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{activeCount}</span>
          )}
        </Button>
      </SheetTrigger>
      {/* Sin autofocus: en celular abriría el teclado al abrir el panel */}
      <SheetContent
        side="left"
        className="w-80 max-w-[85vw] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
        </SheetHeader>
        {/* Cierra el panel al navegar (enlace o envío del formulario) */}
        <div
          className="px-4 pb-6"
          onClickCapture={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
          onSubmitCapture={() => setOpen(false)}
        >
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
