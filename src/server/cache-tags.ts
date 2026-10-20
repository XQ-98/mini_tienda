// Etiquetas de caché. Las lecturas cacheadas con "use cache" se etiquetan con
// estas claves y las acciones del admin las invalidan con updateTag().
export const TAGS = {
  products: "products",
  categories: "categories",
  settings: "settings",
  shipping: "shipping",
} as const;
