import { timingSafeEqual } from "node:crypto";

/**
 * Verifica "Authorization: Bearer <secreto>" en tiempo constante (no revela
 * por tiempo de respuesta cuántos caracteres coinciden). Un secreto vacío o
 * corto nunca autoriza: si falta la variable de entorno, la ruta queda cerrada.
 */
export function isValidBearer(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
