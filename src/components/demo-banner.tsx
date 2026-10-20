import { FlaskConicalIcon } from "lucide-react";

import { DEMO_MODE } from "@/lib/demo";

export function DemoBanner() {
  if (!DEMO_MODE) return null;
  return (
    <div role="note" className="bg-foreground px-4 py-2 text-center text-xs text-background">
      <FlaskConicalIcon className="mr-1.5 inline size-3.5 align-[-2px]" />
      Tienda de demostración: los productos, pagos y envíos son ficticios. Los datos se reinician cada noche.
    </div>
  );
}

export function DemoCredentials() {
  if (!DEMO_MODE) return null;
  return (
    <div className="mb-6 rounded-lg border border-dashed bg-muted/50 p-3 text-xs" data-testid="demo-credentials">
      <p className="mb-1 font-medium">Cuentas de prueba</p>
      <p>
        Admin: <code>admin@telarandino.ec</code> / <code>Admin123!</code>
      </p>
      <p>
        Cliente: <code>cliente@ejemplo.com</code> / <code>Cliente123!</code>
      </p>
    </div>
  );
}
