import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { cloudinaryConfigured, cloudinaryPrivate, cloudinaryPublic } from "./cloudinary";

// Dos almacenamientos con la misma interfaz y dos drivers (STORAGE_DRIVER):
//   - local:      disco del servidor (desarrollo y tests)
//   - cloudinary: producción (en Vercel el disco es efímero y de solo lectura)
//
// PÚBLICO: fotos de productos y logo. Se sirven a cualquiera.
// PRIVADO: comprobantes de pago. Solo vía /api/comprobantes/[id], que verifica permisos.

// Las claves las genera el servidor (UUID); aun así se validan para que nunca
// puedan salir de la carpeta (path traversal: "../../.env").
const KEY_PATTERN = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*\.(jpg|png|webp|pdf)$/;
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

export function assertSafeKey(key: string): void {
  if (!KEY_PATTERN.test(key)) throw new Error(`Clave de almacenamiento inválida: ${key}`);
}

export function contentTypeFor(key: string): string {
  return CONTENT_TYPES[key.split(".").pop()!];
}

export interface StoredFile {
  data: Buffer;
  contentType: string;
}

export interface PrivateStorage {
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  remove(key: string): Promise<void>;
}

export interface PublicStorage {
  /** Guarda el archivo y devuelve la URL pública. */
  put(key: string, data: Uint8Array, contentType: string): Promise<string>;
  remove(key: string): Promise<void>;
}

function driver(): "local" | "cloudinary" {
  const d = process.env.STORAGE_DRIVER ?? "local";
  if (d !== "local" && d !== "cloudinary") throw new Error(`STORAGE_DRIVER inválido: ${d}`);
  if (d === "cloudinary" && !cloudinaryConfigured()) {
    throw new Error("Cloudinary no está configurado (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET)");
  }
  return d;
}

function localDisk(root: string) {
  const resolve = (key: string) => {
    assertSafeKey(key);
    const full = path.resolve(root, key);
    if (!full.startsWith(path.resolve(root) + path.sep)) throw new Error("Ruta fuera del almacenamiento");
    return full;
  };
  return {
    async put(key: string, data: Uint8Array) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
    },
    async get(key: string): Promise<StoredFile | null> {
      try {
        return { data: await readFile(resolve(key)), contentType: contentTypeFor(key) };
      } catch {
        return null;
      }
    },
    async remove(key: string) {
      await rm(resolve(key), { force: true });
    },
  };
}

const uploadsDir = (kind: "private" | "public") =>
  kind === "private"
    ? (process.env.PRIVATE_UPLOADS_DIR ?? path.join(process.cwd(), "uploads", "private"))
    : (process.env.PUBLIC_UPLOADS_DIR ?? path.join(process.cwd(), "uploads", "public"));

export function getPrivateStorage(): PrivateStorage {
  if (driver() === "cloudinary") return cloudinaryPrivate;
  return localDisk(uploadsDir("private"));
}

/** Lector del almacenamiento público local, usado por la ruta /media/[...key]. */
export function localPublicFiles() {
  return localDisk(uploadsDir("public"));
}

export function getPublicStorage(): PublicStorage {
  if (driver() === "cloudinary") return cloudinaryPublic;
  const disk = localDisk(uploadsDir("public"));
  return {
    async put(key, data) {
      await disk.put(key, data);
      return `/media/${key}`;
    },
    remove: (key) => disk.remove(key),
  };
}
