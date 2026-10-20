import { expect, test, variantStock } from "./fixtures";
import { addToCart, buyAsNewCustomer, fillShipping, registerUser, uniqueEmail } from "./helpers";

// Flujo completo de compra desde el celular, con la pasarela de Payphone simulada.

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d4944415478da63f8cfc0f01f0005000201a1c4b7d90000000049454e44ae426082",
  "hex",
);

test.describe("Checkout y pagos", () => {
  test("compra con tarjeta: pedido pagado y stock descontado una sola vez", async ({ page }) => {
    const before = await variantStock("sombrero-panama-clasico", "57 cm", "Natural");

    await buyAsNewCustomer(page, { slug: "sombrero-panama-clasico", size: "57 cm", method: "PAYPHONE" });
    await page.waitForURL((u) => u.pathname === "/pago-simulado");
    await expect(page.getByTestId("mock-amount")).toHaveText("$48.00"); // $45 + $3 de envío a Imbabura

    const approve = page.getByRole("link", { name: "Aprobar pago" });
    const returnUrl = (await approve.getAttribute("href"))!;
    await approve.click();

    await page.waitForURL((u) => u.pathname.startsWith("/cuenta/pedidos/"));
    await expect(page.getByTestId("order-status")).toHaveText("Pagado");
    await expect(page.getByTestId("payment-message")).toContainText("Pago aprobado");
    await expect(page.getByTestId("cart-count")).toHaveCount(0);
    expect(await variantStock("sombrero-panama-clasico", "57 cm", "Natural")).toBe(before - 1);

    // Volver a abrir la URL de retorno (recarga, botón atrás) no descuenta de nuevo
    await page.goto(returnUrl);
    await expect(page.getByTestId("order-status")).toHaveText("Pagado");
    expect(await variantStock("sombrero-panama-clasico", "57 cm", "Natural")).toBe(before - 1);
  });

  test("pago rechazado: el pedido queda pendiente y se puede pagar después", async ({ page }) => {
    await buyAsNewCustomer(page, { slug: "bufanda-alpaca", method: "PAYPHONE" });
    await page.waitForURL((u) => u.pathname === "/pago-simulado");
    await page.getByRole("link", { name: "Rechazar pago" }).click();

    await page.waitForURL((u) => u.pathname.startsWith("/cuenta/pedidos/"));
    await expect(page.getByTestId("order-status")).toHaveText("Pendiente de pago");
    await expect(page.getByTestId("payment-message")).toContainText("no se completó");

    await page.getByRole("button", { name: "Pagar $27.00" }).click();
    await page.waitForURL((u) => u.pathname === "/pago-simulado");
    await page.getByRole("link", { name: "Aprobar pago" }).click();
    await expect(page.getByTestId("order-status")).toHaveText("Pagado");
  });

  test("transferencia: muestra las cuentas, recibe el comprobante y queda en revisión", async ({ page }) => {
    await buyAsNewCustomer(page, { slug: "chalina-tejida-a-mano", method: "BANK_TRANSFER" });
    await expect(page.getByTestId("order-created")).toBeVisible();

    const orderNumber = new URL(page.url()).pathname.split("/").pop();
    await expect(page.getByText("Banco Pichincha")).toBeVisible();
    await expect(page.getByText(`Pedido #${orderNumber}`).first()).toBeVisible();

    await page.locator('input[name="proof"]').setInputFiles({ name: "comprobante.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Enviar comprobante" }).click();
    await expect(page.getByTestId("proof-in-review")).toBeVisible();
    await expect(page.getByTestId("order-status")).toHaveText("Pendiente de pago");

    const href = await page.getByRole("link", { name: /Ver comprobante/ }).getAttribute("href");
    const proof = await page.request.get(href!);
    expect(proof.status()).toBe(200);
    expect(proof.headers()["content-type"]).toBe("image/png");
    expect(proof.headers()["cache-control"]).toContain("no-store");
  });

  test("factura: sobre $50 exige cédula o RUC válidos (norma del SRI)", async ({ page }) => {
    await registerUser(page, uniqueEmail("factura"), "Clave-segura1");
    await addToCart(page, "sombrero-panama-clasico", "57 cm");
    await addToCart(page, "bufanda-alpaca");
    await page.goto("/checkout");
    await fillShipping(page);
    await expect(page.getByTestId("checkout-total")).toHaveText("$72.00");

    // Consumidor final no está disponible
    await expect(page.locator('input[name="billingChoice"]').first()).toBeDisabled();

    await page.getByLabel("Cédula o RUC", { exact: true }).filter({ visible: true }).fill("1710034066");
    await expect(page.getByText("El dígito verificador no coincide")).toBeVisible();

    await page.getByLabel("Cédula o RUC", { exact: true }).filter({ visible: true }).fill("1790011674001");
    await expect(page.getByText("RUC válido")).toBeVisible();
    await page.getByLabel("Nombre o razón social").filter({ visible: true }).fill("Comercial Andina Cía. Ltda.");
    await page.locator("form label").filter({ hasText: "Transferencia bancaria" }).click();
    await page.getByRole("button", { name: /Confirmar pedido/ }).click();

    await expect(page.getByTestId("order-created")).toBeVisible();
    await expect(page.getByText("RUC 1790011674001")).toBeVisible();
    await expect(page.getByTestId("order-total")).toHaveText("$72.00");
  });

  test("el cliente puede cancelar un pedido pendiente", async ({ page }) => {
    await buyAsNewCustomer(page, { slug: "chalina-tejida-a-mano", method: "BANK_TRANSFER" });
    await expect(page.getByTestId("order-created")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cancelar pedido" }).click();
    await expect(page.getByTestId("order-status")).toHaveText("Cancelado");
  });
});
