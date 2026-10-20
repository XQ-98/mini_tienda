import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { getSiteUrl } from "@/lib/site";
import { contentTypeFor, localPublicFiles } from "@/server/storage/storage";

const STATIC_IMAGE = /^\/images\/[a-z0-9/_-]+\.(svg|png|jpg|webp)$/;
const TYPES: Record<string, string> = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

const toDataUri = (data: Buffer, type: string) => `data:${type};base64,${data.toString("base64")}`;

/**
 * Convierte la imagen de un producto en algo que ImageResponse pueda dibujar.
 * Las de Cloudinary van por URL; las locales se leen del disco y, si no están
 * en el bundle (Vercel no incluye /public en las funciones), se descargan del
 * propio sitio. Si nada funciona, la imagen OG se genera sin foto.
 */
export async function ogImageSource(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("https://")) return url;

  try {
    if (url.startsWith("/media/")) {
      const file = await localPublicFiles().get(url.slice("/media/".length));
      if (file) return toDataUri(file.data, file.contentType || contentTypeFor(url));
    }
    if (STATIC_IMAGE.test(url)) {
      const ext = url.split(".").pop()!;
      try {
        return toDataUri(await readFile(path.join(process.cwd(), "public", url)), TYPES[ext]);
      } catch {
        const res = await fetch(`${getSiteUrl()}${url}`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) return toDataUri(Buffer.from(await res.arrayBuffer()), TYPES[ext]);
      }
    }
  } catch (e) {
    console.error("[og] no se pudo cargar la imagen", url, e);
  }
  return null;
}
