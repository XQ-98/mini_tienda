import type { MetadataRoute } from "next";

import { getStoreSettings } from "@/server/queries/settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const store = await getStoreSettings();
  return {
    name: store.storeName,
    short_name: store.storeName,
    description: store.tagline ?? undefined,
    lang: "es-EC",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF8F3",
    theme_color: "#A9472C",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
