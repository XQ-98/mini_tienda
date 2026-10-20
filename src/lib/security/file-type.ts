// Detección del tipo real de un archivo por sus primeros bytes ("magic numbers").
// No se confía en la extensión ni en el Content-Type que envía el navegador:
// un HTML renombrado a .jpg sigue siendo HTML y podría ejecutar scripts.

export type AllowedFileType = { mime: "image/jpeg" | "image/png" | "image/webp" | "application/pdf"; ext: string };

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

export function detectFileType(bytes: Uint8Array): AllowedFileType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return { mime: "image/webp", ext: "webp" };
  if (startsWith(bytes, ascii("%PDF-"))) return { mime: "application/pdf", ext: "pdf" };
  return null;
}

export const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5 MB

export type ProofValidation = { ok: true; type: AllowedFileType } | { ok: false; error: string };

export function validateProofFile(bytes: Uint8Array): ProofValidation {
  if (bytes.byteLength === 0) return { ok: false, error: "El archivo está vacío." };
  if (bytes.byteLength > MAX_PROOF_BYTES) return { ok: false, error: "El archivo supera los 5 MB." };
  const type = detectFileType(bytes);
  if (!type) return { ok: false, error: "Sube una imagen (JPG, PNG o WEBP) o un PDF." };
  return { ok: true, type };
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Imágenes de productos y logo: solo JPG, PNG o WEBP (nada de SVG, que puede llevar scripts). */
export function validateImageFile(bytes: Uint8Array): ProofValidation {
  if (bytes.byteLength === 0) return { ok: false, error: "El archivo está vacío." };
  if (bytes.byteLength > MAX_IMAGE_BYTES) return { ok: false, error: "La imagen supera los 5 MB." };
  const type = detectFileType(bytes);
  if (!type || type.mime === "application/pdf") return { ok: false, error: "Sube una imagen JPG, PNG o WEBP." };
  return { ok: true, type };
}
