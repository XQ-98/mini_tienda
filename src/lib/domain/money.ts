// Todo el dinero de la app se maneja como enteros en centavos de USD.
// Las conversiones a/desde dólares ocurren solo en los bordes (UI y formularios).

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

/** 1250 → "$12.50" */
export function formatUSD(cents: number): string {
  return usd.format(cents / 100);
}

/** "12.5" | 12.5 → 1250. Redondea al centavo más cercano. */
export function dollarsToCents(value: number | string): number {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  if (!Number.isFinite(n)) throw new Error(`Monto inválido: ${value}`);
  return Math.round(n * 100);
}

/** 1250 → 12.5 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** Porcentaje de descuento entre el precio anterior y el actual, o null. */
export function discountPercent(price: number, compareAtPrice?: number | null): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}
