import { expect, type Browser, type Page, type Request } from "@playwright/test";

import { randomIp } from "./fixtures";

export const CLIENTE = { email: "cliente@ejemplo.com", password: "Cliente123!" };

export async function login(page: Page, email: string, password: string, callbackUrl?: string) {
  await page.goto(callbackUrl ? `/ingresar?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/ingresar");
  await page.getByLabel("Correo electrónico").filter({ visible: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).filter({ visible: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

export async function logout(page: Page) {
  await page.goto("/cuenta");
  await page.getByRole("button", { name: /Cerrar sesión/ }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

/** Abre un producto y lo agrega al carrito con la selección inicial (o la talla indicada). */
export async function addToCart(page: Page, slug: string, size?: string) {
  await page.goto(`/productos/${slug}`);
  if (size) await page.locator("label", { hasText: new RegExp(`^${size}$`) }).click();
  await page.getByRole("button", { name: /Agregar al carrito/ }).click();
  await expect(page.getByText(/Producto agregado al carrito/)).toBeVisible();
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@test.ec`;
}

export async function registerUser(page: Page, email: string, password: string) {
  await page.goto("/registro");
  await page.getByLabel("Nombre completo").filter({ visible: true }).fill("Persona de Prueba");
  await page.getByLabel("Correo electrónico").filter({ visible: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).filter({ visible: true }).fill(password);
  await page.getByLabel("Confirmar contraseña").filter({ visible: true }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL((u) => u.pathname === "/cuenta");
}

/** Completa los datos de envío del checkout. */
export async function fillShipping(page: Page, province = "10", city = "Otavalo") {
  await page.getByLabel("Celular").filter({ visible: true }).fill("0991234567");
  await page.getByLabel("Provincia").filter({ visible: true }).selectOption(province);
  await page.getByLabel("Ciudad / cantón").filter({ visible: true }).selectOption(city);
  await page.getByLabel("Dirección").filter({ visible: true }).fill("Calle Bolívar 5-12 y Morales");
}

/** Crea un cliente nuevo (carrito limpio), compra un producto y confirma con el método indicado. */
export async function buyAsNewCustomer(
  page: Page,
  opts: { slug: string; size?: string; method: "PAYPHONE" | "BANK_TRANSFER"; cedula?: string },
) {
  await registerUser(page, uniqueEmail("comprador"), "Clave-segura1");
  await addToCart(page, opts.slug, opts.size);
  await page.goto("/checkout");
  await fillShipping(page);
  if (opts.cedula) {
    await page.getByText("Con cédula o RUC").click();
    await page.getByLabel("Cédula o RUC", { exact: true }).filter({ visible: true }).fill(opts.cedula);
  }
  if (opts.method === "BANK_TRANSFER") await page.locator("form label").filter({ hasText: "Transferencia bancaria" }).click();
  await page.getByRole("button", { name: opts.method === "PAYPHONE" ? /^Pagar/ : /Confirmar pedido/ }).click();
}

export const ADMIN = { email: "admin@telarandino.ec", password: "Admin123!" };

/** Abre un navegador de escritorio aparte (otra IP, otra sesión) con el admin logueado. */
export async function openAdmin(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: { "x-forwarded-for": randomIp() },
  });
  const page = await context.newPage();
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL((u) => u.pathname === "/cuenta");
  return { context, page };
}

/** Reenvía una petición de Server Action capturada, con las cookies del contexto de `page`. */
export function replayAction(page: Page, request: Request, origin: string) {
  return page.request.post(request.url(), {
    headers: {
      "next-action": request.headers()["next-action"],
      "content-type": request.headers()["content-type"],
      accept: "text/x-component",
      origin,
    },
    data: request.postDataBuffer() ?? undefined,
  });
}
