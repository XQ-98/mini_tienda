import { expect, test } from "./fixtures";

import { CLIENTE, addToCart, login } from "./helpers";

test.describe("Carrito", () => {
  test("se agrega desde la ficha, persiste al recargar y se puede editar", async ({ page }) => {
    await page.goto("/productos/camisa-lino-unisex");
    // Con varias tallas, el botón pide elegir una
    await expect(page.getByRole("button", { name: "Elige una talla" })).toBeDisabled();

    await addToCart(page, "camisa-lino-unisex", "M");
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.reload();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.goto("/carrito");
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await expect(page.getByTestId("cart-line")).toContainText("M / Blanco");
    await expect(page.getByTestId("cart-total")).toHaveText("$38.00");

    await page.getByRole("button", { name: "Aumentar cantidad" }).click();
    await expect(page.getByTestId("cart-total")).toHaveText("$76.00");
    await expect(page.getByTestId("cart-count")).toHaveText("2");

    await page.getByRole("button", { name: /Quitar .* del carrito/ }).click();
    await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
  });

  test("el carrito de invitado pasa a la cuenta al iniciar sesión", async ({ page, context }) => {
    await addToCart(page, "sombrero-panama-clasico", "57 cm");
    await login(page, CLIENTE.email, CLIENTE.password, "/carrito");
    await page.waitForURL((u) => u.pathname === "/carrito");

    await expect(page.getByTestId("cart-line").filter({ hasText: "Sombrero Panamá clásico" })).toBeVisible();
    // La cookie del carrito de invitado se elimina tras la fusión
    expect((await context.cookies()).some((c) => c.name === "cart_id")).toBe(false);
  });

  test("checkout exige sesión y vuelve al checkout después del login", async ({ page }) => {
    await addToCart(page, "chalina-tejida-a-mano");
    await page.goto("/carrito");
    await page.getByRole("link", { name: /Continuar compra/ }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/ingresar");

    await page.getByLabel("Correo electrónico").filter({ visible: true }).fill(CLIENTE.email);
    await page.getByLabel("Contraseña", { exact: true }).filter({ visible: true }).fill(CLIENTE.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/checkout");
  });
});
