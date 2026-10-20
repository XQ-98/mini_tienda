// Validación de cédula y RUC ecuatorianos con su dígito verificador.
//
// Cédula (10 dígitos): provincia (01-24 o 30) + tercer dígito 0-5 + módulo 10.
// RUC (13 dígitos), según el tercer dígito:
//   0-5 → persona natural: cédula válida + establecimiento (001…)
//   9   → sociedad privada o extranjero: módulo 11 sobre 9 dígitos
//   6   → entidad pública: módulo 11 sobre 8 dígitos (el verificador es el 9.º)

/** Identificación que el SRI usa para "consumidor final". */
export const CONSUMIDOR_FINAL_ID = "9999999999999";

export type EcIdType = "CEDULA" | "RUC";
export type RucKind = "natural" | "privada" | "publica";

export type EcIdResult =
  | { valid: true; type: EcIdType; kind?: RucKind }
  | { valid: false; reason: string };

const digits = (s: string) => s.split("").map(Number);

function validProvince(id: string): boolean {
  const province = Number(id.slice(0, 2));
  return (province >= 1 && province <= 24) || province === 30;
}

/** Módulo 10 con coeficientes 2,1,2,1… (los productos > 9 restan 9). */
function mod10CheckDigit(first9: string): number {
  const sum = digits(first9).reduce((acc, d, i) => {
    const p = d * (i % 2 === 0 ? 2 : 1);
    return acc + (p > 9 ? p - 9 : p);
  }, 0);
  return (10 - (sum % 10)) % 10;
}

/** Módulo 11: 11 - (suma % 11). Un resultado de 11 vale 0; 10 es inválido. */
function mod11CheckDigit(value: string, coefficients: number[]): number | null {
  const sum = digits(value).reduce((acc, d, i) => acc + d * coefficients[i], 0);
  const check = 11 - (sum % 11);
  if (check === 11) return 0;
  if (check === 10) return null;
  return check;
}

export function validateCedula(input: string): EcIdResult {
  const id = input.trim();
  if (!/^\d{10}$/.test(id)) return { valid: false, reason: "La cédula debe tener 10 dígitos" };
  if (!validProvince(id)) return { valid: false, reason: "Código de provincia inválido" };
  if (Number(id[2]) > 5) return { valid: false, reason: "El tercer dígito de una cédula debe ser de 0 a 5" };
  if (mod10CheckDigit(id.slice(0, 9)) !== Number(id[9])) {
    return { valid: false, reason: "El dígito verificador no coincide" };
  }
  return { valid: true, type: "CEDULA" };
}

export function validateRuc(input: string): EcIdResult {
  const id = input.trim();
  if (!/^\d{13}$/.test(id)) return { valid: false, reason: "El RUC debe tener 13 dígitos" };
  if (id === CONSUMIDOR_FINAL_ID) return { valid: false, reason: "Usa la opción “Consumidor final”" };
  if (!validProvince(id)) return { valid: false, reason: "Código de provincia inválido" };

  const third = Number(id[2]);

  if (third <= 5) {
    const cedula = validateCedula(id.slice(0, 10));
    if (!cedula.valid) return cedula;
    if (id.slice(10) === "000") return { valid: false, reason: "Número de establecimiento inválido" };
    return { valid: true, type: "RUC", kind: "natural" };
  }

  if (third === 9) {
    const check = mod11CheckDigit(id.slice(0, 9), [4, 3, 2, 7, 6, 5, 4, 3, 2]);
    if (check === null || check !== Number(id[9])) {
      return { valid: false, reason: "El dígito verificador no coincide" };
    }
    if (id.slice(10) === "000") return { valid: false, reason: "Número de establecimiento inválido" };
    return { valid: true, type: "RUC", kind: "privada" };
  }

  if (third === 6) {
    const check = mod11CheckDigit(id.slice(0, 8), [3, 2, 7, 6, 5, 4, 3, 2]);
    if (check === null || check !== Number(id[8])) {
      return { valid: false, reason: "El dígito verificador no coincide" };
    }
    if (id.slice(9) === "0000") return { valid: false, reason: "Número de establecimiento inválido" };
    return { valid: true, type: "RUC", kind: "publica" };
  }

  return { valid: false, reason: "El tercer dígito del RUC no es válido" };
}

/** Detecta por longitud si es cédula (10) o RUC (13) y la valida. */
export function validateEcId(input: string): EcIdResult {
  const id = input.trim();
  if (id.length === 10) return validateCedula(id);
  if (id.length === 13) return validateRuc(id);
  return { valid: false, reason: "Ingresa una cédula (10 dígitos) o un RUC (13 dígitos)" };
}
