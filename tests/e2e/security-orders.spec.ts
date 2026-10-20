import { expect, randomIp, test, variantStock } from "./fixtures";
import { buyAsNewCustomer, registerUser, uniqueEmail } from "./helpers";

// Seguridad de pedidos, comprobantes y pagos.

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d4944415478da63f8cfc0f01f0005000201a1c4b7d90000000049454e44ae426082",
  "hex",
);

test.describe("Pedidos y comprobantes: control de acceso (A01)", () => {
  test("otro cliente no puede ver el pedido ni el comprobante; sin sesión tampoco", async ({ page, browser, baseURL }) => {
    // La víctima compra por transferencia y sube su comprobante
    await buyAsNewCustomer(page, { slug: "chalina-tejida-a-mano", method: "BANK_TRANSFER" });
    await page.locator('input[name="proof"]').setInputFiles({ name: "c.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Enviar comprobante" }).click();
    const proofHref = (await page.getByRole("link", { name: /Ver comprobante/ }).getAttribute("href"))!;
    const orderUrl = new URL(page.url()).pathname;

    // Otro cliente, en otro navegador, prueba con las URLs de la víctima
    const attackerContext = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const attacker = await attackerContext.newPage();
    await registerUser(attacker, uniqueEmail("atacante"), "Clave-segura1");

    await attacker.goto(orderUrl);
    await expect(attacker.getByText("No encontramos esta página")).toBeVisible();
    await expect(attacker.getByText("Pagar por transferencia")).toHaveCount(0);
    expect((await attacker.request.get(proofHref)).status()).toBe(404);

    // Sin sesión
    const anonymous = await browser.newContext({ baseURL });
    expect((await anonymous.request.get(proofHref)).status()).toBe(404);

    await attackerContext.close();
    await anonymous.close();
  });
});

test.describe("Subida de archivos (A04/A05)", () => {
  test("rechaza archivos disfrazados: HTML o SVG con extensión de imagen", async ({ page }) => {
    await buyAsNewCustomer(page, { slug: "chalina-tejida-a-mano", method: "BANK_TRANSFER" });

    for (const fake of [
      { name: "comprobante.png", mimeType: "image/png", buffer: Buffer.from("<html><script>alert(1)</script></html>") },
      {
        name: "comprobante.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'),
      },
    ]) {
      await page.locator('input[name="proof"]').setInputFiles(fake);
      await page.getByRole("button", { name: "Enviar comprobante" }).click();
      await expect(page.getByTestId("upload-error")).toContainText("Sube una imagen");
    }
    await expect(page.getByTestId("proof-in-review")).toHaveCount(0);
  });
});

test.describe("Pagos con tarjeta: manipulación (A04/A08)", () => {
  test("un resultado de Payphone falsificado en la URL no aprueba el pedido", async ({ page }) => {
    const before = await variantStock("bufanda-alpaca", "Única", "Gris");
    await buyAsNewCustomer(page, { slug: "bufanda-alpaca", method: "PAYPHONE" });
    await page.waitForURL((u) => u.pathname === "/pago-simulado");
    const tx = new URL(page.url()).searchParams.get("tx")!;
    const amount = new URL(page.url()).searchParams.get("monto")!;

    // El atacante arma la URL de retorno "aprobada" sin pasar por la pasarela
    await page.goto(`/api/pagos/payphone/retorno?id=mock.approved.${amount}.firma-inventada&clientTransactionId=${tx}`);
    await expect(page.getByTestId("payment-message")).toContainText("No pudimos verificar el pago");
    await expect(page.getByTestId("order-status")).toHaveText("Pendiente de pago");
    expect(await variantStock("bufanda-alpaca", "Única", "Gris")).toBe(before);
  });

  test("pagar un monto menor alterando la pasarela no aprueba el pedido", async ({ page }) => {
    await buyAsNewCustomer(page, { slug: "bufanda-alpaca", method: "PAYPHONE" });
    await page.waitForURL((u) => u.pathname === "/pago-simulado");

    // Cambia el monto a $0.01 en la URL de la pasarela y "paga"
    const url = new URL(page.url());
    url.searchParams.set("monto", "1");
    await page.goto(url.toString());
    await expect(page.getByTestId("mock-amount")).toHaveText("$0.01");
    await page.getByRole("link", { name: "Aprobar pago" }).click();

    await page.waitForURL((u) => u.pathname.startsWith("/cuenta/pedidos/"));
    await expect(page.getByTestId("payment-message")).toContainText("No pudimos verificar el pago");
    await expect(page.getByTestId("order-status")).toHaveText("Pendiente de pago");
  });
});
