import { describe, expect, it } from "vitest";

import { isValidBearer } from "@/lib/security/bearer";
import { breadcrumbJsonLd, productJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";

describe("JSON-LD seguro", () => {
  it("un texto con </script> no puede cerrar la etiqueta ni inyectar HTML", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>", note: "a & b > c" });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("&");
    // Y sigue siendo el mismo dato al parsearlo
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script>", note: "a & b > c" });
  });

  it("escapa los separadores de línea U+2028 y U+2029", () => {
    const text = `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c`;
    const out = serializeJsonLd({ text });
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
    expect(JSON.parse(out).text).toBe(text);
  });

  it("producto con un solo precio: Offer en dólares con IVA y disponibilidad", () => {
    const data = productJsonLd("https://tienda.ec", "Telar Andino", {
      name: "Bufanda",
      slug: "bufanda",
      description: "Suave",
      images: [{ url: "/images/products/bufanda-1.svg" }],
      category: { name: "Bufandas" },
      variants: [
        { sku: "B-1", price: 2400, stock: 0 },
        { sku: "B-2", price: 2400, stock: 3 },
      ],
    });
    expect(data.offers).toMatchObject({
      "@type": "Offer",
      price: "24.00",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: "https://tienda.ec/productos/bufanda",
    });
    expect(data.image).toEqual(["https://tienda.ec/images/products/bufanda-1.svg"]);
  });

  it("producto con precios distintos por variante: AggregateOffer; agotado si no hay stock", () => {
    const data = productJsonLd("https://tienda.ec", "T", {
      name: "Sombrero",
      slug: "s",
      description: "d",
      images: [],
      category: { name: "Sombreros" },
      variants: [
        { sku: "S-55", price: 4500, stock: 0 },
        { sku: "S-58", price: 5200, stock: 0 },
      ],
    });
    expect(data.offers).toMatchObject({
      "@type": "AggregateOffer",
      lowPrice: "45.00",
      highPrice: "52.00",
      availability: "https://schema.org/OutOfStock",
    });
  });

  it("las migas de pan usan URLs absolutas y posiciones desde 1", () => {
    const data = breadcrumbJsonLd("https://tienda.ec", [
      { name: "Inicio", path: "/" },
      { name: "Sombreros", path: "/categoria/sombreros" },
    ]);
    expect(data.itemListElement[1]).toEqual({
      "@type": "ListItem",
      position: 2,
      name: "Sombreros",
      item: "https://tienda.ec/categoria/sombreros",
    });
  });
});

describe("secreto del cron de la demo", () => {
  const SECRET = "un-secreto-largo-de-prueba";

  it("acepta solo el Bearer exacto", () => {
    expect(isValidBearer(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isValidBearer(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(isValidBearer(SECRET, SECRET)).toBe(false);
    expect(isValidBearer(null, SECRET)).toBe(false);
  });

  it("si el secreto falta o es corto, la ruta queda cerrada", () => {
    expect(isValidBearer("Bearer ", undefined)).toBe(false);
    expect(isValidBearer("Bearer ", "")).toBe(false);
    expect(isValidBearer("Bearer corto", "corto")).toBe(false);
  });
});
