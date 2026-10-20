/** URL pública del sitio, sin barra final. Se usa en metadata y en las URLs de retorno de pagos. */
export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
