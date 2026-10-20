import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

import { CLIENTE, addToCart, login, logout, registerUser, uniqueEmail } from "./helpers";

// Pruebas de seguridad contra el build de producción, desde el navegador.
// Cada describe corresponde a una categoría del OWASP Top 10.

test.describe("Configuración de seguridad (A05)", () => {
  test("las respuestas incluyen CSP, anti-clickjacking, HSTS y no revelan la tecnología", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();

    expect(h["content-security-policy"]).toContain("default-src 'self'");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["content-security-policy"]).not.toContain("unsafe-eval"); // solo se permite en desarrollo
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toMatch(/max-age=\d+/);
    expect(h["x-powered-by"]).toBeUndefined();
  });
});

test.describe("Control de acceso (A01)", () => {
  for (const path of ["/cuenta", "/checkout", "/admin"]) {
    test(`${path} exige iniciar sesión`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL((u) => u.pathname === "/ingresar" && u.searchParams.get("callbackUrl") === path);
    });
  }

  test("un cliente no puede entrar al panel de administración", async ({ page }) => {
    await login(page, CLIENTE.email, CLIENTE.password);
    await page.waitForURL((u) => u.pathname === "/cuenta");
    await page.goto("/admin");
    await expect(page).toHaveURL((u) => u.pathname === "/");
  });

  test("la sesión no expone el hash de la contraseña ni datos internos", async ({ page }) => {
    await login(page, CLIENTE.email, CLIENTE.password);
    await page.waitForURL((u) => u.pathname === "/cuenta");
    const session = await (await page.request.get("/api/auth/session")).json();

    expect(Object.keys(session.user).sort()).toEqual(["email", "id", "name", "role"]);
    expect(JSON.stringify(session)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });
});

test.describe("Autenticación (A07)", () => {
  test("el error de login es el mismo exista o no el correo (no permite enumerar cuentas)", async ({ page }) => {
    await login(page, CLIENTE.email, "Incorrecta123");
    await expect(page.getByTestId("form-error")).toBeVisible();
    const wrongPassword = await page.getByTestId("form-error").textContent();

    await login(page, uniqueEmail("no-existe"), "Incorrecta123");
    await expect(page.getByTestId("form-error")).toBeVisible();
    const unknownEmail = await page.getByTestId("form-error").textContent();

    expect(wrongPassword).toContain("Correo o contraseña incorrectos");
    expect(unknownEmail).toBe(wrongPassword);
  });

  test("bloquea la cuenta tras 5 intentos fallidos, incluso con la contraseña correcta", async ({ page }) => {
    const email = uniqueEmail("fuerza-bruta");
    const password = "Clave-segura1";
    await registerUser(page, email, password);
    await logout(page);

    for (let i = 0; i < 5; i++) {
      await login(page, email, `Incorrecta${i}`);
      await expect(page.getByTestId("form-error")).toContainText("incorrectos");
    }
    await login(page, email, password);
    await expect(page.getByTestId("form-error")).toContainText("Demasiados intentos");
    await expect(page).toHaveURL((u) => u.pathname === "/ingresar");
  });

  test("las cookies de sesión y de carrito son httpOnly y SameSite=Lax", async ({ page, context }) => {
    await addToCart(page, "chalina-tejida-a-mano");
    const cart = (await context.cookies()).find((c) => c.name === "cart_id");
    expect(cart).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    expect(cart?.value).toMatch(/^[A-Za-z0-9_-]{32}$/);

    await login(page, CLIENTE.email, CLIENTE.password);
    await page.waitForURL((u) => u.pathname === "/cuenta");
    const session = (await context.cookies()).find((c) => c.name.endsWith("authjs.session-token"));
    expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  });

  for (const target of ["https://evil.example/robo", "//evil.example", "/..//evil.example", "/\\evil.example"]) {
    test(`después del login no redirige fuera del sitio con callbackUrl=${target}`, async ({ page, baseURL }) => {
      await login(page, CLIENTE.email, CLIENTE.password, target);
      await page.waitForURL((u) => u.pathname !== "/ingresar");
      expect(new URL(page.url()).origin).toBe(baseURL);
    });
  }
});

test.describe("Inyección y XSS (A03)", () => {
  test("una búsqueda con HTML se muestra como texto y no ejecuta código", async ({ page }) => {
    const payload = `<img src=x onerror="window.__xss=1">`;
    page.on("dialog", (d) => {
      throw new Error(`Se abrió un diálogo inesperado: ${d.message()}`);
    });

    await page.goto(`/productos?q=${encodeURIComponent(payload)}`);
    await expect(page.getByText(payload).first()).toBeVisible();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });

  test("una búsqueda con SQL se trata como texto", async ({ page }) => {
    await page.goto(`/productos?q=${encodeURIComponent("' OR 1=1 --")}`);
    await expect(page.getByText("No encontramos productos")).toBeVisible();
  });
});

test.describe("Manipulación del carrito (A04 – diseño inseguro)", () => {
  test("el precio no se puede alterar desde el navegador", async ({ page }) => {
    await page.goto("/productos/bufanda-alpaca");
    // Un atacante agrega un campo "price" al formulario
    await page.evaluate(() => {
      const input = Object.assign(document.createElement("input"), { type: "hidden", name: "price", value: "1" });
      document.querySelector("form")!.append(input);
    });
    await page.getByRole("button", { name: /Agregar al carrito/ }).click();
    await expect(page.getByText(/Producto agregado al carrito/)).toBeVisible();

    await page.goto("/carrito");
    await expect(page.getByTestId("cart-total")).toHaveText("$24.00"); // precio real
  });

  test("cantidades o IDs manipulados en la petición HTTP se rechazan", async ({ page }) => {
    // Un atacante no usa el formulario: copia la petición de la Server Action y
    // la reenvía con otros valores. Esto prueba la validación del servidor.
    const { original, replay } = await captureAddToCart(page);
    const body = original.postData()!;
    const set = (field: string, value: string) =>
      body.replace(new RegExp(`(name="[^"]*${field}"\r\n\r\n)[^\r\n]*`), `$1${value}`);

    for (const tampered of [
      set("quantity", "999"),
      set("quantity", "-5"),
      set("quantity", "1.5"),
      set("variantId", "' OR 1=1 --"),
      set("variantId", "cnoexiste000000000000000"),
    ]) {
      expect(tampered).not.toBe(body); // el campo se modificó de verdad
      const res = await replay(new URL(page.url()).origin, tampered);
      expect(res.ok()).toBe(true);
      expect(await res.text()).toMatch(/Elige una talla y un color disponibles|ya no está disponible/);
    }

    await page.reload();
    await expect(page.getByTestId("cart-count")).toHaveText("1"); // solo la compra legítima
  });

  test("una Server Action enviada desde otro origen es rechazada (CSRF)", async ({ page }) => {
    const { replay } = await captureAddToCart(page);

    // Desde un sitio malicioso, con las cookies de la víctima: rechazada
    const attack = await replay("https://evil.example");
    expect(attack.ok()).toBe(false);
    await page.reload();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    // Control: la misma petición desde el origen correcto sí funciona
    const legit = await replay(new URL(page.url()).origin);
    expect(legit.ok()).toBe(true);
    await page.reload();
    await expect(page.getByTestId("cart-count")).toHaveText("2");
  });
});

/** Agrega un producto y devuelve la petición HTTP de la Server Action para reenviarla. */
async function captureAddToCart(page: Page) {
  await page.goto("/productos/bufanda-alpaca");
  const request = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  await page.getByRole("button", { name: /Agregar al carrito/ }).click();
  const original = await request;
  await expect(page.getByTestId("cart-count")).toHaveText("1");

  const replay = (origin: string, data: string | Buffer = original.postDataBuffer()!) =>
    page.request.post(original.url(), {
      headers: {
        "next-action": original.headers()["next-action"],
        "content-type": original.headers()["content-type"],
        accept: "text/x-component",
        origin,
      },
      data,
    });
  return { original, replay };
}
