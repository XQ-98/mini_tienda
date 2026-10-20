// Genera las capturas del README en docs/screenshots.
//
// Requiere la app corriendo (npm run dev) con la base sembrada (npm run db:seed)
// y PAYPHONE_MODE=mock. Crea dos pedidos de ejemplo (uno pagado con tarjeta y
// otro con comprobante en revisión) para que el panel tenga datos.
//
//   npm run screenshots                     # usa http://localhost:3000
//   npm run screenshots -- https://mi-demo   # otra URL

import { mkdirSync } from "node:fs";

import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

/** Dibuja un comprobante de transferencia ficticio y lo devuelve como PNG. */
async function fakeReceipt(browser, total, reference) {
  const page = await browser.newPage({ viewport: { width: 360, height: 520 } });
  await page.setContent(`
    <body style="margin:0;font-family:Arial,sans-serif;background:#f3f6fa">
      <div style="margin:16px;padding:20px;background:#fff;border-radius:12px;box-shadow:0 1px 4px #0002">
        <div style="color:#0b3a73;font-weight:bold;font-size:18px">Banco de Ejemplo</div>
        <div style="color:#2e7d32;font-weight:bold;margin:14px 0 4px">✔ Transferencia exitosa</div>
        <div style="font-size:30px;font-weight:bold">${total}</div>
        <hr style="border:none;border-top:1px solid #e3e8ef;margin:16px 0">
        <p style="font-size:13px;color:#555;line-height:1.8;margin:0">
          Para: Telar Andino S.A.S.<br>Cuenta: Ahorros 2200000001<br>
          Referencia: ${reference}<br>Fecha: 20/10/2026 16:15<br>Comprobante N.º 000482913
        </p>
      </div>
    </body>`);
  const png = await page.screenshot();
  await page.close();
  return png;
}
// Oculta el indicador de desarrollo de Next.js en las capturas
const HIDE_DEV = "nextjs-portal { display: none !important; }";

const browser = await chromium.launch();
const withTimeout = async (ctx) => {
  ctx.setDefaultTimeout(120_000);
  return ctx;
};
const mobileCtx = async () =>
  withTimeout(await browser.newContext({ baseURL: BASE, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }));
const desktopCtx = async () => withTimeout(await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } }));

async function shot(page, name, opts = {}) {
  await page.addStyleTag({ content: HIDE_DEV });
  // En desarrollo la primera carga compila la página: se espera, pero sin fallar
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  console.log(`✓ ${name}`);
}

async function login(page, email, password) {
  await page.goto("/ingresar");
  await page.getByLabel("Correo electrónico").filter({ visible: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).filter({ visible: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((u) => u.pathname !== "/ingresar");
}

async function addToCart(page, slug) {
  await page.goto(`/productos/${slug}`);
  await page.getByRole("button", { name: /Agregar al carrito/ }).click();
  await page.getByText("Producto agregado al carrito.").waitFor();
}

async function fillShipping(page) {
  await page.getByLabel("Celular").filter({ visible: true }).fill("0991234567");
  await page.getByLabel("Provincia").filter({ visible: true }).selectOption("17");
  await page.getByLabel("Ciudad / cantón").filter({ visible: true }).selectOption("Quito");
  await page.getByLabel("Dirección").filter({ visible: true }).fill("Av. Amazonas N24-03 y Colón");
}

// ─── Tienda (celular) ───────────────────────────────────────────────────────
const desktop = await desktopCtx();
const home = await desktop.newPage();
await home.goto("/");
await shot(home, "inicio-escritorio");

const m = await mobileCtx();
const p = await m.newPage();
await p.goto("/");
await shot(p, "inicio-celular");
await p.goto("/productos");
await shot(p, "catalogo-celular");
await p.goto("/productos/poncho-alpaca-cotacachi");
await shot(p, "producto-celular");

await login(p, "cliente@ejemplo.com", "Cliente123!");

// Pedido 1: tarjeta (Payphone simulado), aprobado
await addToCart(p, "bufanda-alpaca");
await p.goto("/checkout");
await fillShipping(p);
await p.getByRole("button", { name: /^Pagar/ }).click();
await p.waitForURL((u) => u.pathname === "/pago-simulado");
await shot(p, "pasarela-simulada-celular");
await p.getByRole("link", { name: "Aprobar pago" }).click();
await p.waitForURL((u) => u.pathname.startsWith("/cuenta/pedidos/"));

// Pedido 2: transferencia con comprobante
await addToCart(p, "poncho-alpaca-cotacachi");
await addToCart(p, "chalina-tejida-a-mano");
await p.goto("/carrito");
await shot(p, "carrito-celular");
await p.goto("/checkout");
await fillShipping(p);
await p.getByText("Con cédula o RUC").click();
await p.getByLabel("Cédula o RUC", { exact: true }).filter({ visible: true }).fill("1710034065");
await p.locator("form label").filter({ hasText: "Transferencia bancaria" }).click();
await shot(p, "checkout-celular", { fullPage: true });
await p.getByRole("button", { name: /Confirmar pedido/ }).click();
await p.getByTestId("order-created").waitFor();
const orderNo = new URL(p.url()).pathname.split("/").pop();
const total = (await p.getByTestId("order-total").textContent()).trim();
await p.locator('input[name="proof"]').setInputFiles({
  name: "comprobante.png",
  mimeType: "image/png",
  buffer: await fakeReceipt(browser, total, `Pedido #${orderNo}`),
});
await p.getByRole("button", { name: "Enviar comprobante" }).click();
await p.getByTestId("proof-in-review").waitFor();
const transferOrder = new URL(p.url()).pathname.split("/").pop();
await shot(p, "pedido-celular", { fullPage: true });

// ─── Panel (escritorio) ─────────────────────────────────────────────────────
const a = await desktop.newPage();
await login(a, "admin@telarandino.ec", "Admin123!");
await a.goto("/admin");
await shot(a, "admin-resumen", { fullPage: true });
await a.goto(`/admin/pedidos/${transferOrder}`);
await shot(a, "admin-pedido", { fullPage: true });
await a.goto("/admin/productos");
await a.getByRole("link", { name: /Poncho de alpaca Cotacachi/ }).click();
await a.getByTestId("variant-rows").waitFor();
await shot(a, "admin-producto");

await browser.close();
console.log(`Capturas guardadas en ${OUT}/`);
