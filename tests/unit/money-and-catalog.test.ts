import { describe, expect, it } from "vitest";

import { catalogHref } from "@/lib/catalog-url";
import { discountPercent, dollarsToCents, formatUSD } from "@/lib/domain/money";
import { parseCatalogSearch } from "@/lib/validations/catalog";

describe("dinero", () => {
  it("formatea centavos como dólares", () => {
    expect(formatUSD(1250)).toBe("$12.50");
    expect(formatUSD(123_456)).toBe("$1,234.56");
  });

  it("convierte dólares a centavos sin errores de punto flotante", () => {
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
    expect(dollarsToCents("12,5")).toBe(1250);
    expect(() => dollarsToCents("abc")).toThrow();
  });

  it("calcula el porcentaje de descuento", () => {
    expect(discountPercent(6800, 7900)).toBe(14);
    expect(discountPercent(6800, null)).toBeNull();
    expect(discountPercent(6800, 6000)).toBeNull();
  });
});

describe("filtros del catálogo", () => {
  it("aplica valores por defecto", () => {
    expect(parseCatalogSearch({})).toMatchObject({ orden: "recientes", pagina: 1 });
  });

  it("corrige un rango de precio invertido", () => {
    expect(parseCatalogSearch({ min: "50", max: "10" })).toMatchObject({ min: 10, max: 50 });
  });

  it("toma el primer valor si un parámetro viene repetido", () => {
    expect(parseCatalogSearch({ q: ["poncho", "otro"] }).q).toBe("poncho");
  });

  it("construye URLs y vuelve a la página 1 al cambiar un filtro", () => {
    const current = { q: "lana", pagina: 3, orden: "precio-asc" };
    expect(catalogHref("/productos", current, { min: 20 })).toBe("/productos?q=lana&min=20&orden=precio-asc");
    expect(catalogHref("/productos", current, { pagina: 4 })).toBe("/productos?q=lana&orden=precio-asc&pagina=4");
  });

  it("codifica la búsqueda en la URL", () => {
    expect(catalogHref("/productos", { q: "a&b=c" })).toBe("/productos?q=a%26b%3Dc");
  });
});
