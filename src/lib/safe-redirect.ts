/**
 * Devuelve una ruta interna segura para redirigir después del login.
 * Previene "open redirect": que un enlace como /ingresar?callbackUrl=https://phishing.com
 * lleve al usuario, ya autenticado, a un sitio externo que imita la tienda.
 *
 * Solo acepta rutas relativas al propio sitio ("/cuenta", "/productos?q=x").
 */
export function safeRedirect(target: unknown, fallback = "/"): string {
  if (typeof target !== "string") return fallback;
  const value = target.trim();

  // Debe ser una ruta absoluta del propio sitio, no "//evil.com" (protocol-relative)
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // Los navegadores convierten "\" en "/" ("/\evil.com" → "//evil.com"),
  // y los caracteres de control pueden usarse para confundir al parser.
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;

  try {
    const base = "http://internal.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    const path = url.pathname + url.search + url.hash;
    // La normalización puede volver a crear "//": "/..//evil.com" → "//evil.com".
    // Se valida el resultado final, que es lo que el navegador va a interpretar.
    if (path.startsWith("//")) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
