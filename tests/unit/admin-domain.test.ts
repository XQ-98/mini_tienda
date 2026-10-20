import { describe, expect, it } from "vitest";

import { ecuadorDateKey, ecuadorDayStart, ecuadorMonthStart, lastDays } from "@/lib/domain/dates";
import { slugify } from "@/lib/slug";
import { bankAccountSchema, orderTransitionSchema, productSchema, settingsSchema } from "@/lib/validations/admin";
import { issueMap } from "@/lib/validations/issues";

describe("fechas en hora de Ecuador (UTC-5)", () => {
  it("a las 22:00 en Quito sigue siendo 'hoy', aunque en UTC ya sea mañana", () => {
    const now = new Date("2026-10-20T03:00:00Z"); // 19 oct, 22:00 en Ecuador
    expect(ecuadorDateKey(now)).toBe("2026-10-19");
    expect(ecuadorDayStart(now).toISOString()).toBe("2026-10-19T05:00:00.000Z");
  });

  it("el mes empieza el día 1 a las 00:00 de Ecuador", () => {
    const now = new Date("2026-11-01T02:00:00Z"); // 31 oct, 21:00 en Ecuador
    expect(ecuadorMonthStart(now).toISOString()).toBe("2026-10-01T05:00:00.000Z");
  });

  it("los últimos 30 días terminan hoy y van en orden", () => {
    const days = lastDays(new Date("2026-03-01T12:00:00Z"), 30);
    expect(days).toHaveLength(30);
    expect(days.at(-1)).toBe("2026-03-01");
    expect(days[0]).toBe("2026-01-31");
    expect([...days].sort()).toEqual(days);
  });
});

describe("slugify", () => {
  it.each([
    ["Sombrero de paja toquilla Montecristi", "sombrero-de-paja-toquilla-montecristi"],
    ["Niño & Ñandú: edición 2026", "nino-nandu-edicion-2026"],
    ["  --Blusa   bordada--  ", "blusa-bordada"],
    ["<script>alert(1)</script>", "script-alert-1-script"],
    ["", ""],
  ])("%j → %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("corta a 80 caracteres sin dejar un guion al final", () => {
    const slug = slugify("palabra ".repeat(30));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("producto (panel)", () => {
  const valid = {
    name: "Gorro de lana",
    slug: "gorro-de-lana",
    description: "Gorro tejido a mano con lana de oveja.",
    categoryId: "cmvg3fi8p00034ow0t2yy6quk",
    price: "19.90",
    compareAtPrice: "",
    isActive: true,
    isFeatured: false,
    variants: [
      { sku: "ta-gorro-gris", size: "Única", color: "Gris", colorHex: "#888888", price: "", stock: "12", isActive: true },
    ],
  };

  it("convierte dólares a centavos y normaliza el SKU", () => {
    const p = productSchema.parse(valid);
    expect(p.price).toBe(1990);
    expect(p.compareAtPrice).toBeNull();
    expect(p.variants[0]).toMatchObject({ sku: "TA-GORRO-GRIS", stock: 12, price: null });
  });

  it("detecta talla+color y SKU repetidos, con la ruta exacta del error", () => {
    const r = productSchema.safeParse({ ...valid, variants: [valid.variants[0], { ...valid.variants[0] }] });
    expect(r.success).toBe(false);
    const errors = issueMap(r.error!);
    expect(errors["variants.1.size"]).toEqual(["Talla y color repetidos"]);
    expect(errors["variants.1.sku"]).toEqual(["SKU repetido"]);
  });

  it.each([
    [{ compareAtPrice: "15" }, "compareAtPrice"],
    [{ price: "0" }, "price"],
    [{ price: "-5" }, "price"],
    [{ slug: "Gorro De Lana" }, "slug"],
    [{ variants: [] }, "variants"],
    [{ variants: [{ ...valid.variants[0], stock: "-1" }] }, "variants.0.stock"],
    [{ variants: [{ ...valid.variants[0], stock: "2.5" }] }, "variants.0.stock"],
    [{ variants: [{ ...valid.variants[0], colorHex: "red" }] }, "variants.0.colorHex"],
    [{ variants: [{ ...valid.variants[0], sku: "A B" }] }, "variants.0.sku"],
  ])("rechaza %j (error en %s)", (patch, path) => {
    const r = productSchema.safeParse({ ...valid, ...patch });
    expect(r.success).toBe(false);
    expect(issueMap(r.error!)).toHaveProperty([path]);
  });
});

describe("configuración (panel)", () => {
  const valid = {
    storeName: "Telar Andino",
    tagline: "",
    whatsappNumber: "+593 99 123 4567",
    contactEmail: "Hola@Telar.EC",
    address: "",
    taxRatePercent: "15",
    lowStockThreshold: "5",
    freeShippingFrom: "",
  };

  it("normaliza WhatsApp, correo, IVA y envío gratis", () => {
    expect(settingsSchema.parse(valid)).toMatchObject({
      whatsappNumber: "593991234567",
      contactEmail: "hola@telar.ec",
      taxRatePercent: 1500,
      freeShippingFrom: null,
      tagline: null,
    });
    expect(settingsSchema.parse({ ...valid, taxRatePercent: "12.5" }).taxRatePercent).toBe(1250);
  });

  it.each([{ whatsappNumber: "0991234567" }, { taxRatePercent: "40" }, { contactEmail: "no" }])(
    "rechaza %j",
    (patch) => {
      expect(settingsSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
    },
  );

  it("las cuentas bancarias exigen cédula o RUC válido del titular", () => {
    const account = {
      bankName: "Banco Pichincha",
      accountType: "Ahorros",
      accountNumber: "2200000001",
      holderName: "Telar Andino S.A.S.",
      holderId: "1091234560001",
      isActive: true,
      sortOrder: 0,
    };
    expect(bankAccountSchema.safeParse(account).success).toBe(true);
    expect(bankAccountSchema.safeParse({ ...account, holderId: "1091234567001" }).success).toBe(false);
    expect(bankAccountSchema.safeParse({ ...account, accountNumber: "22-00 0001" }).success).toBe(false);
  });

  it("solo acepta estados de pedido conocidos", () => {
    expect(orderTransitionSchema.safeParse({ orderNumber: 1001, to: "SHIPPED" }).success).toBe(true);
    expect(orderTransitionSchema.safeParse({ orderNumber: 1001, to: "REFUNDED" }).success).toBe(false);
  });
});
