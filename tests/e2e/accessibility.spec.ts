import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { addToCart, openAdmin, registerUser, uniqueEmail } from "./helpers";

// Auditoría automática de accesibilidad (WCAG 2.1 nivel AA) con axe-core.
// Falla ante cualquier violación "serious" o "critical".

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // El indicador de desarrollo de Next.js no es parte de la tienda
    .exclude("nextjs-portal")
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const report = serious.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join("\n  ")}`);
  expect(report, report.join("\n\n")).toEqual([]);
}

test.describe("Accesibilidad (WCAG 2.1 AA)", () => {
  for (const path of ["/", "/productos", "/categoria/sombreros", "/productos/camisa-lino-unisex", "/carrito", "/ingresar", "/registro"]) {
    test(`página pública ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await audit(page);
    });
  }

  test("checkout y cuenta del cliente", async ({ page }) => {
    await registerUser(page, uniqueEmail("a11y"), "Clave-segura1");
    await audit(page); // /cuenta
    await addToCart(page, "bufanda-alpaca");
    await page.goto("/checkout");
    await page.waitForLoadState("networkidle");
    await audit(page);
  });

  test("panel de administración", async ({ browser, baseURL }) => {
    const { page, context } = await openAdmin(browser, baseURL);
    for (const path of ["/admin", "/admin/pedidos", "/admin/productos", "/admin/configuracion"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await audit(page);
    }
    await context.close();
  });
});
