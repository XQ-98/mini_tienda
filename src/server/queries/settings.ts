import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";

export type StoreInfo = Awaited<ReturnType<typeof getStoreSettings>>;

export async function getStoreSettings() {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.settings);

  const settings = await db.storeSettings.findUnique({ where: { id: 1 } });

  // Valores por defecto para que la tienda funcione aunque aún no se haya
  // corrido el seed o configurado desde el panel.
  return {
    storeName: settings?.storeName ?? "Mi Tienda",
    tagline: settings?.tagline ?? null,
    logoUrl: settings?.logoUrl ?? null,
    whatsappNumber: settings?.whatsappNumber ?? null,
    contactEmail: settings?.contactEmail ?? null,
    address: settings?.address ?? null,
    taxRateBps: settings?.taxRateBps ?? 1500,
    lowStockThreshold: settings?.lowStockThreshold ?? 5,
    freeShippingFrom: settings?.freeShippingFrom ?? null,
  };
}
