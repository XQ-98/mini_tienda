import { describe, expect, it } from "vitest";

import { MAX_QTY_PER_ITEM } from "@/lib/domain/cart";
import { emailSchema, loginSchema, passwordSchema, registerSchema } from "@/lib/validations/auth";
import { addToCartSchema, idSchema } from "@/lib/validations/cart";
import { parseCatalogSearch } from "@/lib/validations/catalog";

// Toda entrada del usuario se valida con Zod en el servidor. Estos tests
// prueban que los esquemas rechazan payloads típicos de ataque.

const INJECTION_PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE \"User\"; --",
  '{"$ne": null}',
  "../../etc/passwd",
  "<script>alert(1)</script>",
  "${7*7}",
  "__proto__",
  "a".repeat(5000),
];

describe("registro", () => {
  const valid = {
    name: "María José O'Neil",
    email: "maria@example.com",
    phone: "0991234567",
    password: "Clave-segura1",
    confirmPassword: "Clave-segura1",
  };

  it("acepta datos válidos", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("ignora campos extra como `role` (evita asignación masiva de privilegios)", () => {
    const result = registerSchema.parse({ ...valid, role: "ADMIN", isAdmin: true });
    expect(result).not.toHaveProperty("role");
    expect(result).not.toHaveProperty("isAdmin");
  });

  it.each(INJECTION_PAYLOADS)("rechaza el nombre %j", (name) => {
    expect(registerSchema.safeParse({ ...valid, name }).success).toBe(false);
  });

  it("normaliza el celular y rechaza formatos inválidos", () => {
    expect(registerSchema.parse({ ...valid, phone: "099 123-4567" }).phone).toBe("0991234567");
    expect(registerSchema.parse({ ...valid, phone: "" }).phone).toBeUndefined();
    expect(registerSchema.safeParse({ ...valid, phone: "12345" }).success).toBe(false);
  });

  it("exige que las contraseñas coincidan", () => {
    const r = registerSchema.safeParse({ ...valid, confirmPassword: "otra-cosa1" });
    expect(r.success).toBe(false);
  });
});

describe("correo", () => {
  it("normaliza mayúsculas y espacios (evita cuentas duplicadas Ana@ / ana@)", () => {
    expect(emailSchema.parse("  Ana.Perez@Example.COM ")).toBe("ana.perez@example.com");
  });

  it.each(["ana@", "@example.com", "ana example.com", `${"a".repeat(250)}@x.com`, ...INJECTION_PAYLOADS])(
    "rechaza %j",
    (email) => {
      expect(emailSchema.safeParse(email).success).toBe(false);
    },
  );
});

describe("contraseña", () => {
  it.each([
    ["Corta1", "menos de 8 caracteres"],
    ["solamenteletras", "sin números"],
    ["1234567890", "sin letras"],
  ])("rechaza %j (%s)", (pw) => {
    expect(passwordSchema.safeParse(pw).success).toBe(false);
  });

  it("acepta una contraseña que cumple la política", () => {
    expect(passwordSchema.safeParse("Cl4ve-segura").success).toBe(true);
  });

  it("mide el límite de bcrypt en bytes, no en caracteres", () => {
    // 36 "ñ" = 72 bytes UTF-8 (pero solo 36 caracteres)
    expect(passwordSchema.safeParse("a1" + "ñ".repeat(35)).success).toBe(true); // 2 + 70 = 72 bytes
    expect(passwordSchema.safeParse("a1" + "ñ".repeat(36)).success).toBe(false); // 74 bytes
  });

  it("el login limita el tamaño (evita hashear payloads gigantes)", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x".repeat(201) }).success).toBe(false);
  });
});

describe("carrito", () => {
  const variantId = "cmvg3fi8p00034ow0t2yy6quk";

  it("acepta una petición válida y convierte la cantidad a número", () => {
    expect(addToCartSchema.parse({ variantId, quantity: "2" })).toEqual({ variantId, quantity: 2 });
  });

  it.each([-1, 0, 1.5, MAX_QTY_PER_ITEM + 1, "1e9", "NaN", "Infinity", "1; DROP TABLE", "", null])(
    "rechaza la cantidad %j",
    (quantity) => {
      expect(addToCartSchema.safeParse({ variantId, quantity }).success).toBe(false);
    },
  );

  it.each([...INJECTION_PAYLOADS, "", "CMVG3FI8P00034OW0T2YY6QUK", "abc"])("rechaza el ID %j", (id) => {
    expect(idSchema.safeParse(id).success).toBe(false);
  });
});

describe("búsqueda del catálogo", () => {
  it("descarta búsquedas demasiado largas en lugar de fallar", () => {
    expect(parseCatalogSearch({ q: "a".repeat(101) }).q).toBeUndefined();
  });

  it.each(["../../admin", "sombreros' OR 1=1--", "<script>"])("ignora la categoría inválida %j", (categoria) => {
    expect(parseCatalogSearch({ categoria }).categoria).toBeUndefined();
  });

  it("ignora precios negativos y páginas absurdas", () => {
    const f = parseCatalogSearch({ min: "-5", pagina: "999999" });
    expect(f.min).toBeUndefined();
    expect(f.pagina).toBe(1);
  });

  it("conserva el texto de búsqueda tal cual (React lo escapa al mostrarlo)", () => {
    expect(parseCatalogSearch({ q: "<img src=x onerror=alert(1)>" }).q).toBe("<img src=x onerror=alert(1)>");
  });
});
