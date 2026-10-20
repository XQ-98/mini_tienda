import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy: limita de dónde se pueden cargar scripts, estilos,
// imágenes y frames. Si un atacante lograra inyectar HTML, el navegador
// bloquearía scripts externos y el envío de datos a otros dominios.
//
// 'unsafe-inline' en script-src es necesario porque Next.js inserta scripts
// inline. La alternativa (nonces) obliga a renderizar todo de forma dinámica y
// se pierde el prerenderizado estático; es un trade-off documentado.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'", // nadie puede incrustar la tienda en un iframe (clickjacking)
  "base-uri 'self'",
  // Payphone: si el navegador envía el formulario sin JavaScript, la redirección al pago es un "form-action"
  "form-action 'self' https://pay.payphonetodoaldia.com",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false, // no anunciar "X-Powered-By: Next.js"
  images: {
    // El optimizador de imágenes solo procesa estas rutas (evita que se use
    // para descargar o redimensionar cualquier cosa del servidor o de internet).
    localPatterns: [
      { pathname: "/images/**", search: "" },
      { pathname: "/media/**", search: "" },
    ],
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com", pathname: "/**/image/upload/**" }],
  },
  experimental: {
    serverActions: {
      // Comprobantes de hasta 5 MB + overhead del multipart. El resto de
      // acciones son pequeñas; el tamaño de cada archivo se valida aparte.
      bodySizeLimit: "6mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
