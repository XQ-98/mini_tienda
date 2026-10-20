import type { z } from "zod";

/** Errores de Zod como { "variants.0.sku": ["SKU repetido"] }, incluidos los anidados. */
export function issueMap(error: z.ZodError): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (map[key] ??= []).push(issue.message);
  }
  return map;
}
