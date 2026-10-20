import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-heading text-6xl font-semibold text-primary">404</p>
      <h1 className="mt-4 font-heading text-2xl font-semibold">No encontramos esta página</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Puede que el producto ya no esté disponible o que el enlace tenga un error.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild className="h-10">
          <Link href="/productos">Ver catálogo</Link>
        </Button>
        <Button asChild variant="outline" className="h-10">
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </main>
  );
}
