import { expect, test, variantStock } from "./fixtures";
import { fillShipping, openAdmin, uniqueEmail } from "./helpers";

// El recorrido completo de una compra, tal como lo haría un cliente desde el
// celular y el dueño de la tienda desde su computadora:
// buscar → elegir variante → carrito → crear cuenta → checkout → transferencia →
// comprobante → el admin aprueba y despacha → el cliente ve su pedido entregado.

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d4944415478da63f8cfc0f01f0005000201a1c4b7d90000000049454e44ae426082",
  "hex",
);

test("flujo completo de compra: de la búsqueda al pedido entregado", async ({ page, browser, baseURL }) => {
  const stockBefore = await variantStock("camisa-lino-unisex", "L", "Azul");
  let orderNumber = 0;

  await test.step("busca un producto desde el menú del celular", async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const search = page.getByRole("searchbox", { name: "Buscar productos" }).filter({ visible: true });
    await search.fill("lino");
    await search.press("Enter");
    await expect(page).toHaveURL((u) => u.pathname === "/productos" && u.searchParams.get("q") === "lino");
    await page.getByRole("link", { name: "Camisa de lino unisex" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Camisa de lino unisex");
  });

  await test.step("elige color y talla y agrega 2 unidades", async () => {
    // Se toca la muestra de color y la talla, como lo haría el cliente
    await page.locator('label[title="Azul"]').click();
    await page.locator("label").filter({ hasText: /^L$/ }).click();
    await expect(page.getByRole("radio", { name: "Azul" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "L", exact: true })).toBeChecked();
    await page.getByRole("button", { name: "Aumentar cantidad" }).click();
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await expect(page.getByText("Producto agregado al carrito.")).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("2");
  });

  await test.step("revisa el carrito; para pagar crea una cuenta y vuelve al checkout", async () => {
    await page.goto("/carrito");
    await expect(page.getByTestId("cart-line")).toContainText("L / Azul");
    await expect(page.getByTestId("cart-total")).toHaveText("$76.00");
    await page.getByRole("link", { name: /Continuar compra/ }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/ingresar");

    await page.getByRole("link", { name: "Crea una" }).click();
    await page.getByLabel("Nombre completo").filter({ visible: true }).fill("Lucía Cabascango");
    await page.getByLabel("Correo electrónico").filter({ visible: true }).fill(uniqueEmail("flujo"));
    await page.getByLabel("Contraseña", { exact: true }).filter({ visible: true }).fill("Clave-segura1");
    await page.getByLabel("Confirmar contraseña").filter({ visible: true }).fill("Clave-segura1");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/checkout"); // el carrito de invitado pasó a la cuenta
  });

  await test.step("completa envío y factura con cédula, y elige transferencia", async () => {
    await fillShipping(page, "17", "Quito");
    // $76 + $4 de envío a Pichincha = $80: sobre $50 el SRI exige cédula o RUC
    await expect(page.getByTestId("checkout-total")).toHaveText("$80.00");
    await page.getByLabel("Cédula o RUC", { exact: true }).filter({ visible: true }).fill("1710034065");
    await expect(page.getByText("Cédula válida")).toBeVisible();
    await page.locator("form label").filter({ hasText: "Transferencia bancaria" }).click();
    await page.getByRole("button", { name: /Confirmar pedido/ }).click();
    await expect(page.getByTestId("order-created")).toBeVisible();
    orderNumber = Number(new URL(page.url()).pathname.split("/").pop());
  });

  await test.step("transfiere y sube el comprobante", async () => {
    await expect(page.getByText(`Pedido #${orderNumber}`).first()).toBeVisible();
    await page.locator('input[name="proof"]').setInputFiles({ name: "transferencia.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Enviar comprobante" }).click();
    await expect(page.getByTestId("proof-in-review")).toBeVisible();
  });

  await test.step("el admin aprueba el pago, despacha y marca la entrega", async () => {
    const { page: admin, context } = await openAdmin(browser, baseURL);
    await admin.goto(`/admin/pedidos/${orderNumber}`);
    const status = admin.getByTestId("order-status").filter({ visible: true });

    await admin.getByRole("button", { name: "Aprobar pago" }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Aprobar pago" }).click();
    await expect(status).toHaveText("Pagado");
    expect(await variantStock("camisa-lino-unisex", "L", "Azul")).toBe(stockBefore - 2);

    await admin.getByRole("button", { name: "Marcar como enviado" }).click();
    await admin.getByLabel("Número de guía").filter({ visible: true }).fill("Servientrega 555000111");
    await admin.getByRole("button", { name: "Confirmar envío" }).click();
    await expect(status).toHaveText("Enviado");

    await admin.getByRole("button", { name: "Marcar como entregado" }).click();
    await admin.getByRole("button", { name: "Sí, entregado" }).click();
    await expect(status).toHaveText("Entregado");
    await context.close();
  });

  await test.step("el cliente ve su pedido entregado en el historial", async () => {
    await page.goto("/cuenta");
    const row = page.getByTestId("order-list").getByRole("link", { name: new RegExp(`Pedido #${orderNumber}`) });
    await expect(row).toContainText("Entregado");
    await expect(row).toContainText("$80.00");
    await row.click();
    await expect(page.getByText("Guía: Servientrega 555000111")).toBeVisible();
    await expect(page.getByRole("list", { name: "Estado del pedido" }).locator("[aria-current=step]")).toContainText("Entregado");
  });
});
