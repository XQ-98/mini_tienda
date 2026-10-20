"use client";

import { useEffect } from "react";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Pantalla para errores inesperados: no muestra detalles técnicos al cliente. */
export function ErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-heading text-5xl font-semibold text-primary">Ups</p>
      <h1 className="mt-4 font-heading text-2xl font-semibold">Algo salió mal</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Tuvimos un problema al cargar esta página. Inténtalo de nuevo; si continúa, escríbenos por WhatsApp.
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted-foreground">Código: {error.digest}</p>}
      <Button onClick={reset} className="mt-8 h-10">
        <RefreshCwIcon /> Reintentar
      </Button>
    </div>
  );
}
