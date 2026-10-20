import { describe, expect, it } from "vitest";

import { CONSUMIDOR_FINAL_ID, validateCedula, validateEcId, validateRuc } from "@/lib/domain/ec-id";

// Los números válidos se verificaron a mano con el algoritmo del Registro Civil
// (módulo 10) y del SRI (módulo 11).

describe("cédula (módulo 10)", () => {
  it.each(["1710034065", "0926687856", "1104680135", "0102030400"])("acepta %s", (id) => {
    expect(validateCedula(id)).toEqual({ valid: true, type: "CEDULA" });
  });

  it.each([
    ["1710034066", "dígito verificador incorrecto"],
    ["0926687855", "dígito verificador incorrecto"],
    ["2510034065", "provincia 25 no existe"],
    ["0010034065", "provincia 00 no existe"],
    ["1760034065", "tercer dígito 6 no es de persona natural"],
    ["171003406", "9 dígitos"],
    ["17100340650", "11 dígitos"],
    ["17100340A5", "contiene letras"],
    ["", "vacía"],
  ])("rechaza %s (%s)", (id) => {
    expect(validateCedula(id).valid).toBe(false);
  });

  it("acepta cédulas de ecuatorianos en el exterior (código 30)", () => {
    // 3 0 0 0 0 0 0 0 0 → suma 6 → verificador 4
    expect(validateCedula("3000000004").valid).toBe(true);
  });
});

describe("RUC", () => {
  it("persona natural: cédula válida + establecimiento", () => {
    expect(validateRuc("1710034065001")).toEqual({ valid: true, type: "RUC", kind: "natural" });
    expect(validateRuc("1710034065000").valid).toBe(false); // establecimiento 000
    expect(validateRuc("1710034066001").valid).toBe(false); // cédula inválida
  });

  it("sociedad privada (tercer dígito 9, módulo 11)", () => {
    expect(validateRuc("1790011674001")).toEqual({ valid: true, type: "RUC", kind: "privada" });
    expect(validateRuc("1091234560001")).toEqual({ valid: true, type: "RUC", kind: "privada" }); // verificador 0 (11 → 0)
    expect(validateRuc("1790011675001").valid).toBe(false);
  });

  it("entidad pública (tercer dígito 6, verificador en la 9.ª posición)", () => {
    expect(validateRuc("1760013210001")).toEqual({ valid: true, type: "RUC", kind: "publica" }); // RUC del SRI
    expect(validateRuc("1760013220001").valid).toBe(false);
  });

  it("rechaza el número de consumidor final como RUC", () => {
    expect(validateRuc(CONSUMIDOR_FINAL_ID).valid).toBe(false);
  });

  it("rechaza tercer dígito 7 u 8", () => {
    expect(validateRuc("1770011674001").valid).toBe(false);
  });
});

describe("validateEcId", () => {
  it("detecta el tipo por longitud", () => {
    expect(validateEcId("1710034065")).toMatchObject({ valid: true, type: "CEDULA" });
    expect(validateEcId(" 1790011674001 ")).toMatchObject({ valid: true, type: "RUC" });
    expect(validateEcId("12345").valid).toBe(false);
  });
});
