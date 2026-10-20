import { localPublicFiles } from "@/server/storage/storage";

// Sirve las imágenes públicas subidas con el driver local (desarrollo y tests).
// Con Cloudinary las imágenes vienen de su CDN y esta ruta no se usa.
// Solo imágenes: un PDF o cualquier otra extensión responde 404.

const IMAGE_KEY = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*\.(jpg|png|webp)$/;

export async function GET(_request: Request, ctx: RouteContext<"/media/[...key]">) {
  const key = (await ctx.params).key.join("/");
  if (!IMAGE_KEY.test(key)) return new Response("No encontrado", { status: 404 });

  const file = await localPublicFiles().get(key);
  if (!file) return new Response("No encontrado", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      // Las claves llevan un UUID: el contenido de una URL nunca cambia
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
