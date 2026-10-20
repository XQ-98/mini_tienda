import { describe, expect, it } from "vitest";

import {
  compareSizes,
  findVariant,
  initialSelection,
  uniqueColors,
  uniqueSizes,
  variantLabel,
} from "@/lib/domain/variants";

const v = (id: string, size: string | null, color: string | null, stock: number) => ({
  id,
  size,
  color,
  colorHex: "#000000",
  stock,
});

describe("orden de tallas", () => {
  it("ordena tallas de letra como en una tienda, no alfabéticamente", () => {
    expect(["XL", "S", "L", "M"].sort(compareSizes)).toEqual(["S", "M", "L", "XL"]);
  });

  it("ordena medidas numéricas", () => {
    expect(["58 cm", "55 cm", "57 cm"].sort(compareSizes)).toEqual(["55 cm", "57 cm", "58 cm"]);
  });

  it("deja 'Única' al final", () => {
    expect(["Única", "M"].sort(compareSizes)).toEqual(["M", "Única"]);
  });
});

describe("variantes", () => {
  const variants = [v("1", "M", "Azul", 0), v("2", "S", "Azul", 2), v("3", "S", "Rojo", 5), v("4", "L", "Rojo", 1)];

  it("lista tallas y colores únicos", () => {
    expect(uniqueSizes(variants)).toEqual(["S", "M", "L"]);
    expect(uniqueColors(variants).map((c) => c.name)).toEqual(["Azul", "Rojo"]);
  });

  it("encuentra la variante por talla y color", () => {
    expect(findVariant(variants, "S", "Rojo")?.id).toBe("3");
    expect(findVariant(variants, "XL", "Rojo")).toBeUndefined();
  });

  it("la selección inicial elige el primer color con stock y no fuerza talla", () => {
    expect(initialSelection(variants)).toEqual({ color: "Azul", size: null });
  });

  it("con talla única la preselecciona", () => {
    expect(initialSelection([v("1", "Única", "Gris", 3)])).toEqual({ color: "Gris", size: "Única" });
  });

  it("arma la etiqueta legible", () => {
    expect(variantLabel({ size: "M", color: "Azul" })).toBe("M / Azul");
    expect(variantLabel({ size: "Única", color: "Gris" })).toBe("Gris");
    expect(variantLabel({ size: null, color: null })).toBe("Única");
  });
});
