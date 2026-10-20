// Totales del pedido. Los precios de productos y del envío ya incluyen IVA
// (PVP); el IVA se desglosa del total para la factura.

import { lineTotal, splitTax, type CartLine } from "./cart";

/**
 * Límite del SRI para facturar a "consumidor final" sin identificar al
 * comprador: $50. Por encima, la factura debe llevar cédula o RUC.
 */
export const CONSUMIDOR_FINAL_MAX = 5000;

export function shippingCost(itemsTotal: number, rateCost: number, freeShippingFrom: number | null): number {
  if (freeShippingFrom !== null && itemsTotal >= freeShippingFrom) return 0;
  return rateCost;
}

export interface OrderTotals {
  itemsTotal: number; // productos, IVA incluido
  shipping: number; // envío, IVA incluido
  subtotal: number; // base imponible (sin IVA)
  tax: number; // IVA
  total: number; // lo que paga el cliente
}

export function computeOrderTotals(input: {
  lines: CartLine[];
  rateCost: number;
  freeShippingFrom: number | null;
  taxRateBps: number;
}): OrderTotals {
  const itemsTotal = input.lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const shipping = shippingCost(itemsTotal, input.rateCost, input.freeShippingFrom);
  const total = itemsTotal + shipping;
  const { base, tax } = splitTax(total, input.taxRateBps);
  return { itemsTotal, shipping, subtotal: base, tax, total };
}

export function exceedsConsumidorFinal(total: number): boolean {
  return total > CONSUMIDOR_FINAL_MAX;
}
