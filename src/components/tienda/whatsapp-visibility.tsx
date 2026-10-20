"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";

// En carrito y checkout el botón flotante taparía "Continuar compra" / "Pagar"
// en el celular, justo donde se concreta la venta.
const HIDDEN_ON = ["/carrito", "/checkout"];

function Gate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return HIDDEN_ON.some((p) => pathname.startsWith(p)) ? null : children;
}

export function WhatsAppVisibility({ children }: { children: ReactNode }) {
  // usePathname() lee la URL: va dentro de Suspense (Cache Components)
  return (
    <Suspense fallback={null}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
