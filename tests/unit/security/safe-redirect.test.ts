import { describe, expect, it } from "vitest";

import { safeRedirect } from "@/lib/safe-redirect";

// Open redirect (OWASP: Unvalidated Redirects and Forwards): un enlace de
// phishing como /ingresar?callbackUrl=https://tienda-falsa.com enviaría a la
// víctima, recién autenticada, a un sitio que imita la tienda.

describe("safeRedirect", () => {
  it.each(["/cuenta", "/productos?q=poncho&min=10", "/carrito#resumen", "/categoria/sombreros"])(
    "permite la ruta interna %s",
    (path) => {
      expect(safeRedirect(path)).toBe(path);
    },
  );

  it.each([
    ["https://evil.example/login", "URL absoluta externa"],
    ["http://evil.example", "http externo"],
    ["//evil.example", "protocol-relative"],
    ["///evil.example", "triple barra"],
    ["/\\evil.example", "barra invertida (el navegador la convierte en //)"],
    ["\\\\evil.example", "doble barra invertida"],
    ["/\t/evil.example", "tabulación entre barras"],
    ["/\n/evil.example", "salto de línea entre barras"],
    ["javascript:alert(document.cookie)", "esquema javascript:"],
    ["data:text/html,<script>alert(1)</script>", "esquema data:"],
    ["https:evil.example", "esquema sin barras"],
    ["  //evil.example", "espacios al inicio"],
    // Regresión: la normalización de "/.." convertía esto en "//evil.example"
    ["/..//evil.example", "segmento .. que se normaliza a //"],
    ["/./..//evil.example", "segmentos . y .. combinados"],
    ["", "vacío"],
  ])("bloquea %j (%s)", (target) => {
    expect(safeRedirect(target, "/cuenta")).toBe("/cuenta");
  });

  it.each([null, undefined, 42, ["//evil.example"], { href: "//evil.example" }])(
    "usa el valor por defecto si el tipo no es string: %j",
    (value) => {
      expect(safeRedirect(value, "/")).toBe("/");
    },
  );

  it("cualquier resultado es siempre una ruta del mismo sitio", () => {
    const attempts = [
      "/%2F%2Fevil.example",
      "/..//evil.example",
      "/./evil.example",
      "/%5Cevil.example",
      "/cuenta?next=//evil.example",
    ];
    for (const attempt of attempts) {
      const result = safeRedirect(attempt);
      expect(result.startsWith("/")).toBe(true);
      expect(result.startsWith("//")).toBe(false);
      expect(new URL(result, "https://tienda.ec").origin).toBe("https://tienda.ec");
    }
  });
});
