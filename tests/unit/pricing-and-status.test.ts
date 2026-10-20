import { describe, expect, it } from "vitest";

import { canTransition, ORDER_STATUSES } from "@/lib/domain/order-status";
import { CONSUMIDOR_FINAL_MAX, computeOrderTotals, exceedsConsumidorFinal, shippingCost } from "@/lib/domain/pricing";

describe("envío", () => {
  it("cobra la tarifa de la provincia", () => {
    expect(shippingCost(5000, 400, 10_000)).toBe(400);
  });

  it("es gratis desde el monto configurado (inclusive)", () => {
    expect(shippingCost(10_000, 400, 10_000)).toBe(0);
    expect(shippingCost(9_999, 400, 10_000)).toBe(400);
  });

  it("sin umbral configurado siempre se cobra", () => {
    expect(shippingCost(1_000_000, 1500, null)).toBe(1500);
  });
});

describe("totales del pedido (IVA incluido en productos y envío)", () => {
  it("suma productos y envío y desglosa el IVA del total", () => {
    const totals = computeOrderTotals({
      lines: [
        { unitPrice: 2400, quantity: 1 },
        { unitPrice: 3800, quantity: 1 },
      ],
      rateCost: 300,
      freeShippingFrom: 10_000,
      taxRateBps: 1500,
    });
    // 24 + 38 + 3 = 65 → base 56.52, IVA 8.48
    expect(totals).toEqual({ itemsTotal: 6200, shipping: 300, subtotal: 5652, tax: 848, total: 6500 });
  });

  it("aplica envío gratis y el IVA se calcula solo sobre los productos", () => {
    const totals = computeOrderTotals({
      lines: [{ unitPrice: 5000, quantity: 2 }],
      rateCost: 1500,
      freeShippingFrom: 10_000,
      taxRateBps: 1500,
    });
    expect(totals).toMatchObject({ shipping: 0, total: 10_000, subtotal: 8696, tax: 1304 });
  });

  it("subtotal + IVA siempre es igual al total", () => {
    for (let price = 1; price < 20_000; price += 37) {
      const t = computeOrderTotals({
        lines: [{ unitPrice: price, quantity: 3 }],
        rateCost: 550,
        freeShippingFrom: null,
        taxRateBps: 1500,
      });
      expect(t.subtotal + t.tax).toBe(t.total);
    }
  });
});

describe("consumidor final", () => {
  it(`permite hasta $${CONSUMIDOR_FINAL_MAX / 100} y exige identificación por encima`, () => {
    expect(exceedsConsumidorFinal(CONSUMIDOR_FINAL_MAX)).toBe(false);
    expect(exceedsConsumidorFinal(CONSUMIDOR_FINAL_MAX + 1)).toBe(true);
  });
});

describe("máquina de estados del pedido", () => {
  it.each([
    ["PENDING_PAYMENT", "PAID"],
    ["PENDING_PAYMENT", "CANCELLED"],
    ["PAID", "SHIPPED"],
    ["PAID", "CANCELLED"],
    ["SHIPPED", "DELIVERED"],
  ] as const)("permite %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ["PENDING_PAYMENT", "SHIPPED"], // enviar sin cobrar
    ["PENDING_PAYMENT", "DELIVERED"],
    ["SHIPPED", "CANCELLED"], // ya salió de bodega
    ["DELIVERED", "PENDING_PAYMENT"],
    ["CANCELLED", "PAID"], // revivir un pedido cancelado
  ] as const)("prohíbe %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it("los estados finales no tienen salida", () => {
    for (const to of ORDER_STATUSES) {
      expect(canTransition("DELIVERED", to)).toBe(false);
      expect(canTransition("CANCELLED", to)).toBe(false);
    }
  });
});
