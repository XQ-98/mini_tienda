"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import type { AdminResult } from "@/server/actions/admin";

/** Ejecuta una acción del panel y muestra el resultado en un toast. */
export function useAdminAction() {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<AdminResult | void>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result) return; // la acción redirigió
      if (result.ok) {
        if (result.message) toast.success(result.message);
        onSuccess?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  return { pending, run };
}
