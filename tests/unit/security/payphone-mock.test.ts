import { beforeAll, describe, expect, it } from "vitest";

import { assertSafeKey } from "@/server/storage/storage";
import { mockTransactionId, verifyMockTransactionId } from "@/server/payments/payphone";

beforeAll(() => {
  process.env.AUTH_SECRET = "secreto-de-prueba";
});

const TX = "TA-1001-a1b2c3d4e5f6";

describe("pasarela simulada: el resultado va firmado (HMAC)", () => {
  it("verifica un id generado por la pasarela", () => {
    const id = mockTransactionId("approved", TX, 6500);
    expect(verifyMockTransactionId(id, TX)).toEqual({ decision: "approved", amount: 6500 });
  });

  it("rechaza cambiar la decisión, el monto o la transacción", () => {
    const id = mockTransactionId("canceled", TX, 6500);
    const [, , amount, sig] = id.split(".");

    expect(verifyMockTransactionId(`mock.approved.${amount}.${sig}`, TX)).toBeNull(); // cancelado → aprobado
    expect(verifyMockTransactionId(`mock.canceled.1.${sig}`, TX)).toBeNull(); // otro monto
    expect(verifyMockTransactionId(id, "TA-1002-a1b2c3d4e5f6")).toBeNull(); // otro pedido
  });

  it.each(["mock.approved.6500.", "mock.approved.6500.firmafalsa", "mock.approved.-5.x", "approved", "", "a.b.c.d.e"])(
    "rechaza el id %j",
    (id) => {
      expect(verifyMockTransactionId(id, TX)).toBeNull();
    },
  );

  it("una firma hecha con otro secreto no sirve", () => {
    const id = mockTransactionId("approved", TX, 6500);
    process.env.AUTH_SECRET = "otro-secreto";
    expect(verifyMockTransactionId(id, TX)).toBeNull();
    process.env.AUTH_SECRET = "secreto-de-prueba";
  });
});

describe("almacenamiento privado: claves seguras (path traversal)", () => {
  it("acepta claves generadas por el servidor", () => {
    expect(() => assertSafeKey("comprobantes/cmabc123/550e8400-e29b-41d4-a716-446655440000.pdf")).not.toThrow();
  });

  it.each([
    "../../.env",
    "comprobantes/../../../etc/passwd.pdf",
    "/etc/passwd.pdf",
    "comprobantes\\..\\x.pdf",
    "comprobantes/x.html",
    "comprobantes/x.svg",
    "comprobantes/X.PDF",
    "comprobantes//x.pdf",
  ])("rechaza %j", (key) => {
    expect(() => assertSafeKey(key)).toThrow();
  });
});
