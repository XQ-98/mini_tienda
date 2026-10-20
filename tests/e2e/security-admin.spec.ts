import type { Request } from "@playwright/test";

import { expect, queryDb, test } from "./fixtures";
import { login, logout, openAdmin, registerUser, replayAction, uniqueEmail } from "./helpers";

// Seguridad del panel: el control de acceso no depende de que el botón esté
// oculto ni de estar en /admin, sino de que cada acción verifique el rol.

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d4944415478da63f8cfc0f01f0005000201a1c4b7d90000000049454e44ae426082",
  "hex",
);

const orellanaCost = async () =>
  (await queryDb<{ cost: number }>(`SELECT cost FROM "ShippingRate" WHERE "provinceCode" = '22'`))[0].cost;

test.describe("Panel: control de acceso (A01)", () => {
  test("un cliente o un visitante no puede ejecutar acciones de admin, aunque copie la petición", async ({ page, browser, baseURL }) => {
    // 1. El admin prepara un cambio, pero la petición se intercepta antes de llegar
    const { page: admin, context } = await openAdmin(browser, baseURL);
    await admin.goto("/admin/configuracion");
    await admin.getByRole("tab", { name: "Envíos" }).click();
    const cents = 9000 + Math.floor(Math.random() * 900);
    await admin.getByLabel("Costo Orellana").filter({ visible: true }).fill((cents / 100).toFixed(2));

    let captured: Request | undefined;
    await admin.route("**/admin/configuracion", async (route) => {
      if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
        captured = route.request();
        await route.abort();
      } else await route.continue();
    });
    await admin.getByRole("button", { name: "Guardar tarifas" }).click();
    await expect.poll(() => captured !== undefined).toBe(true);
    await admin.unrouteAll();
    const original = await orellanaCost();
    expect(original).not.toBe(cents);

    // 2. Un cliente logueado reenvía la misma petición con SUS cookies
    await registerUser(page, uniqueEmail("no-admin"), "Clave-segura1");
    await replayAction(page, captured!, baseURL!);
    expect(await orellanaCost()).toBe(original);

    // 3. Un visitante sin sesión, igual
    const anonymous = await browser.newContext({ baseURL });
    const anonPage = await anonymous.newPage();
    await replayAction(anonPage, captured!, baseURL!);
    expect(await orellanaCost()).toBe(original);

    // Control: la misma petición con la sesión del admin sí aplica el cambio
    await replayAction(admin, captured!, baseURL!);
    expect(await orellanaCost()).toBe(cents);

    await anonymous.close();
    await context.close();
  });

  test("si a un admin le quitan el rol, pierde el acceso aunque su sesión siga activa", async ({ page }) => {
    const email = uniqueEmail("ex-admin");
    await registerUser(page, email, "Clave-segura1");
    await queryDb(`UPDATE "User" SET role = 'ADMIN' WHERE email = $1`, [email]);
    await logout(page); // nueva sesión para que el JWT lleve el rol ADMIN
    await login(page, email, "Clave-segura1", "/admin");
    await expect(page.getByTestId("dashboard-stats")).toBeVisible();

    // Se le quita el rol en la BD; su JWT todavía dice ADMIN
    await queryDb(`UPDATE "User" SET role = 'CUSTOMER' WHERE email = $1`, [email]);
    await page.goto("/admin");
    await expect(page.getByText("No encontramos esta página")).toBeVisible();
    await expect(page.getByTestId("dashboard-stats")).toHaveCount(0);
  });
});

test.describe("Panel: archivos (A04/A05)", () => {
  test("una imagen de producto disfrazada (SVG con script) se rechaza", async ({ browser, baseURL }) => {
    const { page: admin, context } = await openAdmin(browser, baseURL);
    await admin.goto("/admin/productos?q=bufanda");
    await admin.getByRole("link", { name: /Bufanda de alpaca/ }).click();
    const images = admin.getByTestId("product-images").getByRole("img");
    await expect(images.first()).toBeVisible(); // count() no espera a que cargue
    const before = await images.count();

    await admin.getByLabel("Subir imágenes").filter({ visible: true }).setInputFiles({
      name: "foto.png",
      mimeType: "image/png",
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.cookie)"/>'),
    });
    await expect(admin.getByText("Sube una imagen JPG, PNG o WEBP.")).toBeVisible();
    await expect(images).toHaveCount(before);

    // Control: una imagen real sí se acepta
    await admin.getByLabel("Subir imágenes").filter({ visible: true }).setInputFiles({ name: "ok.png", mimeType: "image/png", buffer: PNG });
    await expect(images).toHaveCount(before + 1);
    await context.close();
  });

  test("la ruta de imágenes públicas no permite leer otros archivos (path traversal)", async ({ request }) => {
    for (const path of [
      "/media/..%2f..%2f.env",
      "/media/%2e%2e/%2e%2e/package.json",
      "/media/productos/x.pdf",
      "/media/productos/x.svg",
      "/media/private/comprobantes/x.png",
    ]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });
});
