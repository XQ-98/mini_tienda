import { expect, test, variantStock } from "./fixtures";
import { ADMIN, addToCart, buyAsNewCustomer, fillShipping, login, openAdmin, registerUser, uniqueEmail } from "./helpers";

// Panel de administración: los flujos que usa el dueño de la tienda a diario.
// El cliente usa el celular (fixture `page`); el admin, un navegador de escritorio aparte.

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d4944415478da63f8cfc0f01f0005000201a1c4b7d90000000049454e44ae426082",
  "hex",
);

async function customerTransferWithProof(page: import("@playwright/test").Page) {
  await buyAsNewCustomer(page, { slug: "chalina-tejida-a-mano", method: "BANK_TRANSFER" });
  await page.locator('input[name="proof"]').setInputFiles({ name: "c.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Enviar comprobante" }).click();
  await expect(page.getByTestId("proof-in-review")).toBeVisible();
  return Number(new URL(page.url()).pathname.split("/").pop());
}

test.describe("Panel: pedidos", () => {
  test("aprobar transferencia → pagado y stock descontado → enviado con guía → entregado", async ({ page, browser, baseURL }) => {
    const orderNumber = await customerTransferWithProof(page);
    const before = await variantStock("chalina-tejida-a-mano", "Única", "Multicolor");

    const { page: admin, context } = await openAdmin(browser, baseURL);
    await admin.goto("/admin/pedidos?filtro=revision");
    await admin.getByRole("link", { name: `#${orderNumber}` }).click();

    await admin.getByRole("button", { name: "Aprobar pago" }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Aprobar pago" }).click();
    await expect(admin.getByTestId("order-status").filter({ visible: true })).toHaveText("Pagado");
    expect(await variantStock("chalina-tejida-a-mano", "Única", "Multicolor")).toBe(before - 1);

    await admin.getByRole("button", { name: "Marcar como enviado" }).click();
    await admin.getByLabel("Número de guía").filter({ visible: true }).fill("Servientrega 987654321");
    await admin.getByRole("button", { name: "Confirmar envío" }).click();
    await expect(admin.getByTestId("order-status").filter({ visible: true })).toHaveText("Enviado");

    // El cliente ve el estado y la guía
    await page.reload();
    await expect(page.getByTestId("order-status")).toHaveText("Enviado");
    await expect(page.getByText("Guía: Servientrega 987654321")).toBeVisible();

    await admin.getByRole("button", { name: "Marcar como entregado" }).click();
    await admin.getByRole("button", { name: "Sí, entregado" }).click();
    await expect(admin.getByTestId("order-status").filter({ visible: true })).toHaveText("Entregado");
    await expect(admin.getByTestId("order-events").filter({ visible: true })).toContainText("Guía: Servientrega 987654321");
    await context.close();
  });

  test("rechazar un comprobante: el cliente ve el motivo y puede subir otro", async ({ page, browser, baseURL }) => {
    const orderNumber = await customerTransferWithProof(page);

    const { page: admin, context } = await openAdmin(browser, baseURL);
    await admin.goto(`/admin/pedidos/${orderNumber}`);
    await admin.getByRole("button", { name: "Rechazar" }).click();
    await admin.getByLabel("Motivo").filter({ visible: true }).fill("El monto transferido no coincide con el pedido");
    await admin.getByRole("dialog").getByRole("button", { name: "Rechazar" }).click();
    await expect(admin.getByText("Comprobante rechazado. El cliente puede subir otro.")).toBeVisible();
    await context.close();

    await page.reload();
    await expect(page.getByText(/rechazado: El monto transferido no coincide/)).toBeVisible();
    await expect(page.getByText("Sube un nuevo comprobante")).toBeVisible();
  });
});

test.describe("Panel: catálogo", () => {
  test("crear producto con imagen, verlo en la tienda, cambiar el precio y eliminarlo", async ({ page, browser, baseURL }) => {
    const id = Date.now().toString(36);
    const name = `Gorro de prueba ${id}`;
    const { page: admin, context } = await openAdmin(browser, baseURL);

    await admin.goto("/admin/productos/nuevo");
    await admin.getByLabel("Nombre", { exact: true }).filter({ visible: true }).fill(name);
    await admin.getByLabel("Descripción").filter({ visible: true }).fill("Gorro tejido a mano para pruebas automáticas.");
    await admin.getByLabel("Precio (USD, IVA incluido)").filter({ visible: true }).fill("19.90");
    await admin.getByLabel("SKU variante 1").filter({ visible: true }).fill(`E2E-${id}`.toUpperCase());
    await admin.getByLabel("Color variante 1", { exact: true }).filter({ visible: true }).fill("Gris");
    await admin.getByLabel("Stock variante 1").filter({ visible: true }).fill("5");
    await admin.getByRole("button", { name: "Crear producto" }).click();
    await admin.waitForURL((u) => /^\/admin\/productos\/[a-z0-9]{20,}$/.test(u.pathname));

    await admin.getByLabel("Subir imágenes").filter({ visible: true }).setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await expect(admin.getByText("1 imagen(es) subida(s).")).toBeVisible();
    await expect(admin.getByTestId("product-images").getByRole("img")).toHaveCount(1);

    const slug = `gorro-de-prueba-${id}`;
    await page.goto(`/productos/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page.getByText("$19.90").first()).toBeVisible();

    // Editar el precio invalida la caché del producto
    await admin.getByLabel("Precio (USD, IVA incluido)").filter({ visible: true }).fill("21.50");
    await admin.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(admin.getByText("Producto guardado.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("$21.50").first()).toBeVisible();

    admin.once("dialog", (d) => d.accept());
    await admin.getByRole("button", { name: "Eliminar producto" }).click();
    await admin.waitForURL((u) => u.pathname === "/admin/productos");
    await page.reload();
    await expect(page.getByText("No encontramos esta página")).toBeVisible();
    await context.close();
  });

  test("categorías: crear, ver en la tienda y eliminar; con productos no se puede eliminar", async ({ page, browser, baseURL }) => {
    const id = Date.now().toString(36);
    const { page: admin, context } = await openAdmin(browser, baseURL);
    await admin.goto("/admin/categorias");
    await expect(admin.getByRole("button", { name: "Eliminar Sombreros" })).toBeDisabled();

    await admin.getByRole("button", { name: "Nueva categoría" }).click();
    await admin.getByLabel("Nombre").filter({ visible: true }).fill(`Ponchos niños ${id}`);
    await admin.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
    await expect(admin.getByText("Categoría guardada.")).toBeVisible();

    await page.goto(`/categoria/ponchos-ninos-${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Ponchos niños ${id}`);

    admin.once("dialog", (d) => d.accept());
    await admin.getByRole("button", { name: `Eliminar Ponchos niños ${id}` }).click();
    await expect(admin.getByText("Categoría eliminada.")).toBeVisible();
    await context.close();
  });
});

test.describe("Panel: configuración y resumen", () => {
  test("cambiar el costo de envío de una provincia se refleja en el checkout", async ({ page, browser, baseURL }) => {
    const { page: admin, context } = await openAdmin(browser, baseURL);
    await admin.goto("/admin/configuracion");
    await admin.getByRole("tab", { name: "Envíos" }).click();
    await admin.getByLabel("Costo Galápagos").filter({ visible: true }).fill("17.50");
    await admin.getByRole("button", { name: "Guardar tarifas" }).click();
    await expect(admin.getByText("Tarifas de envío guardadas.")).toBeVisible();
    await context.close();

    await registerUser(page, uniqueEmail("galapagos"), "Clave-segura1");
    await addToCart(page, "bufanda-alpaca");
    await page.goto("/checkout");
    await fillShipping(page, "20", "Santa Cruz");
    await expect(page.getByTestId("checkout-total")).toHaveText("$41.50"); // $24 + $17.50
  });

  test("el resumen muestra ventas, pendientes y poco stock", async ({ browser, baseURL }) => {
    const { page: admin, context } = await openAdmin(browser, baseURL);
    await admin.goto("/admin");
    await expect(admin.getByTestId("dashboard-stats")).toContainText("Ventas de hoy");
    await expect(admin.getByText("Ventas de los últimos 30 días")).toBeVisible();
    await expect(admin.getByTestId("low-stock").getByRole("link").first()).toBeVisible();
    await context.close();
  });
});

test.describe("Panel: sesión", () => {
  test("cerrar sesión desde el panel (escritorio y celular) y volver a pedir login", async ({ browser, baseURL }) => {
    const { page: admin, context } = await openAdmin(browser, baseURL);
    await admin.goto("/admin");
    await admin.getByRole("button", { name: "Cerrar sesión" }).click();
    await admin.waitForURL((u) => u.pathname === "/");
    await admin.goto("/admin");
    await expect(admin).toHaveURL(/\/ingresar\?callbackUrl=%2Fadmin$/);

    // En celular el botón está dentro del menú lateral
    await admin.setViewportSize({ width: 390, height: 844 });
    await login(admin, ADMIN.email, ADMIN.password, "/admin");
    await admin.waitForURL((u) => u.pathname === "/admin");
    await admin.getByRole("button", { name: "Abrir menú" }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Cerrar sesión" }).click();
    await admin.waitForURL((u) => u.pathname === "/");
    await admin.goto("/admin/pedidos");
    await expect(admin).toHaveURL(/\/ingresar/);
    await context.close();
  });
});
