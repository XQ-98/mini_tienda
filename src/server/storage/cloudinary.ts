import "server-only";

import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

import type { PrivateStorage, PublicStorage, StoredFile } from "./storage";

// Driver de Cloudinary. Las imágenes públicas se suben como "upload" (URL
// pública por CDN). Los comprobantes, como "authenticated": no tienen URL
// pública; el servidor los descarga con una URL firmada que nunca llega al navegador.

export function cloudinaryConfigured(): boolean {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

function client() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

// "productos/abc.jpg" → public_id "productos/abc", formato "jpg"
function split(key: string) {
  const dot = key.lastIndexOf(".");
  return { publicId: key.slice(0, dot), format: key.slice(dot + 1) };
}

function upload(key: string, data: Uint8Array, type: "upload" | "authenticated"): Promise<UploadApiResponse> {
  const { publicId } = split(key);
  return new Promise((resolve, reject) => {
    client()
      .uploader.upload_stream(
        { public_id: publicId, resource_type: "image", type, overwrite: false },
        (error, result) => (error || !result ? reject(error ?? new Error("Cloudinary sin respuesta")) : resolve(result)),
      )
      .end(Buffer.from(data));
  });
}

async function destroy(key: string, type: "upload" | "authenticated") {
  await client().uploader.destroy(split(key).publicId, { resource_type: "image", type, invalidate: true });
}

export const cloudinaryPublic: PublicStorage = {
  async put(key, data) {
    return (await upload(key, data, "upload")).secure_url;
  },
  remove: (key) => destroy(key, "upload"),
};

export const cloudinaryPrivate: PrivateStorage = {
  async put(key, data) {
    await upload(key, data, "authenticated");
  },
  async get(key): Promise<StoredFile | null> {
    const { publicId, format } = split(key);
    const url = client().url(publicId, {
      type: "authenticated",
      resource_type: "image",
      format,
      sign_url: true,
      secure: true,
    });
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return { data: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "application/octet-stream" };
  },
  remove: (key) => destroy(key, "authenticated"),
};
