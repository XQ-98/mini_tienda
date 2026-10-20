// Cálculos del carrito. Todo en centavos (enteros) y sin efectos secundarios,
// para poder testearlo sin base de datos.

/** Máximo de unidades de una misma variante por pedido. Evita acaparamiento. */
export const MAX_QTY_PER_ITEM = 10;

export interface CartLine {
  unitPrice: number; // centavos, PVP con IVA incluido
  quantity: number;
}

export interface CartSummary {
  itemCount: number;
  total: number; // suma de líneas, IVA incluido
  taxBase: number; // base imponible
  tax: number; // IVA contenido en el total
}

function assertCents(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} debe ser un entero de centavos >= 0 (recibido: ${value})`);
  }
}

export function lineTotal(line: CartLine): number {
  assertCents(line.unitPrice, "unitPrice");
  if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
    throw new RangeError(`quantity debe ser un entero >= 1 (recibido: ${line.quantity})`);
  }
  return line.unitPrice * line.quantity;
}

/**
 * Separa el IVA de un monto que ya lo incluye.
 * base = total / (1 + tasa), redondeado al centavo; el IVA es la diferencia,
 * así base + iva === total siempre (no se pierde ni se inventa un centavo).
 */
export function splitTax(totalCents: number, taxRateBps: number): { base: number; tax: number } {
  assertCents(totalCents, "total");
  if (!Number.isInteger(taxRateBps) || taxRateBps < 0 || taxRateBps > 10_000) {
    throw new RangeError(`Tasa inválida: ${taxRateBps}`);
  }
  const base = Math.round((totalCents * 10_000) / (10_000 + taxRateBps));
  return { base, tax: totalCents - base };
}

export function summarizeCart(lines: CartLine[], taxRateBps: number): CartSummary {
  const total = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const { base, tax } = splitTax(total, taxRateBps);
  return {
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    total,
    taxBase: base,
    tax,
  };
}

/** Cantidad final permitida: nunca negativa, ni mayor al stock ni al máximo por ítem. */
export function clampQuantity(requested: number, stock: number): number {
  if (!Number.isFinite(requested) || !Number.isFinite(stock)) return 0;
  return Math.max(0, Math.min(Math.floor(requested), Math.floor(stock), MAX_QTY_PER_ITEM));
}
