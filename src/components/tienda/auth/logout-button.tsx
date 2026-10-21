"use client";

import { useTransition } from "react";
import { Loader2Icon, LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";

export function LogoutButton({ className }: { className?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      className={cn("h-10 w-full", className)}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await logoutAction();
          // Recarga completa intencional (guía "Preserving UI state" de Next.js):
          // router.push() conservaría ocultas las páginas con datos de la cuenta.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/";
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <LogOutIcon />} Cerrar sesión
    </Button>
  );
}
