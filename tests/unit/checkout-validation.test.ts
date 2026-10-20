import { describe, expect, it } from "vitest";

import { PROVINCES, isValidCanton } from "@/lib/data/ecuador";
import { CONSUMIDOR_FINAL_ID } from "@/lib/domain/ec-id";
import { checkoutSchema, toBilling } from "@/lib/validations/checkout";

const base = {
  shipName: "María Guamán",
  shipPhone: "0991234567",
  shipProvince: "10",
  shipCity: "Otavalo",
  shipAddress: "Calle Bolívar 5-12 y Morales",
  shipReference: "",
  billingType: "consumidor_final",
  paymentMethod: "PAYPHONE",
};

const errorsOf = (data: object) => {
  const r = checkoutSchema.safeParse(data);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
};

describe("datos de Ecuador", () => {
  it("tiene las 24 provincias y 221 cantones, sin duplicados", () => {
    expect(PROVINCES).toHaveLength(24);
    expect(PROVINCES.reduce((n, p) => n + p.cantons.length, 0)).toBe(221);
    for (const p of PROVINCES) expect(new Set(p.cantons).size).toBe(p.cantons.length);
    expect(PROVINCES.map((p) => p.code)).toEqual(Array.from({ length: 24 }, (_, i) => String(i + 1).padStart(2, "0")));
  });

  it("valida que el cantón pertenezca a la provincia", () => {
    expect(isValidCanton("17", "Quito")).toBe(true);
    expect(isValidCanton("09", "Quito")).toBe(false);
    expect(isValidCanton("99", "Quito")).toBe(false);
  });
});

describe("checkout", () => {
  it("acepta un pedido válido y normaliza el celular", () => {
    const r = checkoutSchema.parse({ ...base, shipPhone: "099 123-4567" });
    expect(r.shipPhone).toBe("0991234567");
    expect(r.shipReference).toBeUndefined();
  });

  it("rechaza una ciudad que no es de la provincia elegida", () => {
    expect(errorsOf({ ...base, shipProvince: "09", shipCity: "Otavalo" })).toHaveProperty("shipCity");
  });

  it("rechaza provincias inventadas y métodos de pago desconocidos", () => {
    expect(errorsOf({ ...base, shipProvince: "99" })).toHaveProperty("shipProvince");
    expect(errorsOf({ ...base, paymentMethod: "EFECTIVO" })).toHaveProperty("paymentMethod");
  });

  it("con factura exige cédula/RUC válido, nombre y correo", () => {
    const e = errorsOf({ ...base, billingType: "datos", billId: "1710034066", billName: "", billEmail: "x" });
    expect(e.billId).toMatch(/verificador/);
    expect(e).toHaveProperty("billName");
    expect(e).toHaveProperty("billEmail");
  });

  it("arma los datos de facturación normalizados", () => {
    const cf = checkoutSchema.parse(base);
    expect(toBilling(cf, "ana@x.com")).toEqual({
      idType: "CONSUMIDOR_FINAL",
      id: CONSUMIDOR_FINAL_ID,
      name: "CONSUMIDOR FINAL",
      email: "ana@x.com",
    });

    const ruc = checkoutSchema.parse({
      ...base,
      billingType: "datos",
      billId: "1790011674001",
      billName: "Comercial Andina Cía. Ltda.",
      billEmail: "Facturas@Andina.EC",
    });
    expect(toBilling(ruc, "ana@x.com")).toEqual({
      idType: "RUC",
      id: "1790011674001",
      name: "Comercial Andina Cía. Ltda.",
      email: "facturas@andina.ec",
    });
  });

  it.each(["<script>alert(1)</script>", "'; DROP TABLE \"Order\"; --", "a".repeat(201)])(
    "rechaza la dirección o razón social maliciosa %j",
    (value) => {
      const e = errorsOf({ ...base, billingType: "datos", billId: "1710034065", billName: value, billEmail: "a@b.co" });
      expect(e).toHaveProperty("billName");
    },
  );
});
