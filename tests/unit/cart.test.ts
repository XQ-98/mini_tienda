import { describe, expect, it } from "vitest";

import { MAX_QTY_PER_ITEM, clampQuantity, lineTotal, splitTax, summarizeCart } from "@/lib/domain/cart";

describe("lineTotal", () => {
  it("multiplica precio por cantidad en centavos", () => {
    expect(lineTotal({ unitPrice: 1250, quantity: 2 })).toBe(2500);
  });

  it.each([
    [{ unitPrice: 12.5, quantity: 1 }, "precio con decimales"],
    [{ unitPrice: -100, quantity: 1 }, "precio negativo"],
    [{ unitPrice: 100, quantity: 0 }, "cantidad cero"],
    [{ unitPrice: 100, quantity: 1.5 }, "cantidad fraccionaria"],
    [{ unitPrice: Number.NaN, quantity: 1 }, "precio NaN"],
  ])("rechaza %o (%s)", (line) => {
    expect(() => lineTotal(line)).toThrow(RangeError);
  });
});

describe("splitTax (IVA incluido)", () => {
  it("separa el IVA 15 % de un total redondo", () => {
    expect(splitTax(11_500, 1500)).toEqual({ base: 10_000, tax: 1500 });
  });

  it("redondea la base al centavo", () => {
    // $1.00 con IVA incluido → base $0.87, IVA $0.13
    expect(splitTax(100, 1500)).toEqual({ base: 87, tax: 13 });
  });

  it("devuelve cero para un total cero", () => {
    expect(splitTax(0, 1500)).toEqual({ base: 0, tax: 0 });
  });

  it("base + IVA siempre suma exactamente el total (no se pierden centavos)", () => {
    for (let total = 0; total <= 50_000; total += 7) {
      const { base, tax } = splitTax(total, 1500);
      expect(base + tax).toBe(total);
      // El IVA es el 15 % de la base, con tolerancia de un centavo por redondeo
      expect(Math.abs(tax - base * 0.15)).toBeLessThanOrEqual(1);
    }
  });

  it.each([-1, 10_001, 15.5])("rechaza la tasa inválida %s", (rate) => {
    expect(() => splitTax(1000, rate)).toThrow(RangeError);
  });
});

describe("summarizeCart", () => {
  it("suma líneas, unidades e IVA contenido", () => {
    const summary = summarizeCart(
      [
        { unitPrice: 3800, quantity: 2 }, // camisa x2
        { unitPrice: 2400, quantity: 1 }, // bufanda
      ],
      1500,
    );
    expect(summary).toEqual({ itemCount: 3, total: 10_000, taxBase: 8696, tax: 1304 });
  });

  it("un carrito vacío da cero", () => {
    expect(summarizeCart([], 1500)).toEqual({ itemCount: 0, total: 0, taxBase: 0, tax: 0 });
  });
});

describe("clampQuantity", () => {
  it("no supera el stock disponible", () => {
    expect(clampQuantity(5, 3)).toBe(3);
  });

  it(`no supera el máximo por producto (${MAX_QTY_PER_ITEM})`, () => {
    expect(clampQuantity(50, 100)).toBe(MAX_QTY_PER_ITEM);
  });

  it.each([
    [-3, 5, 0],
    [Number.NaN, 5, 0],
    [Number.POSITIVE_INFINITY, 5, 0],
    [2.7, 5, 2],
    [4, -1, 0],
  ])("clampQuantity(%s, %s) = %s", (requested, stock, expected) => {
    expect(clampQuantity(requested, stock)).toBe(expected);
  });
});
