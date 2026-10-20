// Datos estructurados (schema.org) para Google: producto con precio y stock,
// migas de pan, tienda y buscador interno.

// U+2028 y U+2029 son saltos de línea válidos en JSON pero no en JavaScript.
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), "g");
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), "g");

/**
 * JSON.stringify NO es seguro dentro de <script>: un nombre de producto como
 * "</script><script>alert(1)</script>" cerraría la etiqueta. Se escapan los
 * caracteres que el parser de HTML interpreta (y U+2028/2029, que rompen JS).
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LINE_SEPARATOR, "\\u2028")
    .replace(PARAGRAPH_SEPARATOR, "\\u2029");
}

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}

export const absoluteUrl = (siteUrl: string, path: string) =>
  path.startsWith("http") ? path : `${siteUrl}${path.startsWith("/") ? "" : "/"}${path}`;

export function breadcrumbJsonLd(siteUrl: string, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(siteUrl, item.path),
    })),
  };
}

export function productJsonLd(
  siteUrl: string,
  storeName: string,
  p: {
    name: string;
    slug: string;
    description: string;
    images: { url: string }[];
    category: { name: string };
    variants: { sku: string; price: number; stock: number }[];
  },
) {
  const prices = p.variants.map((v) => v.price);
  const inStock = p.variants.some((v) => v.stock > 0);
  const url = absoluteUrl(siteUrl, `/productos/${p.slug}`);
  const availability = inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  const low = Math.min(...prices);
  const high = Math.max(...prices);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image: p.images.map((i) => absoluteUrl(siteUrl, i.url)),
    sku: p.variants[0]?.sku,
    category: p.category.name,
    brand: { "@type": "Brand", name: storeName },
    // Precio en dólares con IVA incluido (el precio que paga el cliente)
    offers:
      low === high
        ? { "@type": "Offer", url, priceCurrency: "USD", price: (low / 100).toFixed(2), availability }
        : {
            "@type": "AggregateOffer",
            url,
            priceCurrency: "USD",
            lowPrice: (low / 100).toFixed(2),
            highPrice: (high / 100).toFixed(2),
            offerCount: p.variants.length,
            availability,
          },
  };
}
