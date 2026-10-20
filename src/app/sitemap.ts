import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site";
import { getSitemapData } from "@/server/queries/catalog";

// Solo páginas públicas e indexables. Carrito, cuenta, checkout y admin quedan
// fuera (además están bloqueados en robots.txt y marcados noindex).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  const { products, categories } = await getSitemapData();
  const latest = products[0]?.updatedAt;

  return [
    { url: `${site}/`, lastModified: latest, changeFrequency: "daily", priority: 1 },
    { url: `${site}/productos`, lastModified: latest, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((c) => ({
      url: `${site}/categoria/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${site}/productos/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
