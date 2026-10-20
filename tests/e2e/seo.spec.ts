import { expect, test } from "./fixtures";
import { openAdmin } from "./helpers";

const jsonLdBlocks = async (page: import("@playwright/test").Page) =>
  (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap((t) => JSON.parse(t));

test.describe("SEO", () => {
  test("robots.txt bloquea las páginas privadas y apunta al sitemap", async ({ request, baseURL }) => {
    const robots = await (await request.get("/robots.txt")).text();
    for (const path of ["/admin", "/cuenta", "/checkout", "/carrito", "/api/"]) expect(robots).toContain(`Disallow: ${path}`);
    expect(robots).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
  });

  test("el sitemap lista categorías y productos, y ninguna página privada", async ({ request, baseURL }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain(`<loc>${baseURL}/categoria/sombreros</loc>`);
    expect(xml).toContain(`<loc>${baseURL}/productos/bufanda-alpaca</loc>`);
    expect(xml).not.toMatch(/\/(admin|cuenta|checkout|carrito)/);
  });

  test("la ficha de producto tiene título, canonical, Open Graph y datos estructurados", async ({ page, request, baseURL }) => {
    await page.goto("/productos/bufanda-alpaca");
    await expect(page).toHaveTitle("Bufanda de alpaca | Telar Andino");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${baseURL}/productos/bufanda-alpaca`);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");

    // La imagen para compartir es un PNG generado de 1200×630
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    const img = await request.get(ogImage!);
    expect(img.headers()["content-type"]).toBe("image/png");

    const ld = await jsonLdBlocks(page);
    const product = ld.find((b) => b["@type"] === "Product");
    expect(product).toMatchObject({ name: "Bufanda de alpaca", offers: { priceCurrency: "USD", price: "24.00" } });
    expect(ld.find((b) => b["@type"] === "BreadcrumbList").itemListElement).toHaveLength(3);
  });

  test("el inicio declara la tienda y el buscador interno", async ({ page }) => {
    await page.goto("/");
    const ld = await jsonLdBlocks(page);
    expect(ld.find((b) => b["@type"] === "WebSite").potentialAction["@type"]).toBe("SearchAction");
    expect(ld.find((b) => b["@type"] === "ClothingStore").currenciesAccepted).toBe("USD");
  });

  test("un nombre de producto malicioso no rompe el JSON-LD ni ejecuta código (XSS)", async ({ page, browser, baseURL }) => {
    const id = Date.now().toString(36);
    const name = `Gorro </script><script>window.__xss=1</script> ${id}`;
    const { page: admin, context } = await openAdmin(browser, baseURL);
    await admin.goto("/admin/productos/nuevo");
    await admin.getByLabel("Nombre", { exact: true }).filter({ visible: true }).fill(name);
    await admin.getByLabel("URL (slug)").filter({ visible: true }).fill(`gorro-xss-${id}`);
    await admin.getByLabel("Descripción").filter({ visible: true }).fill("Producto para probar el escape del JSON-LD.");
    await admin.getByLabel("Precio (USD, IVA incluido)").filter({ visible: true }).fill("10");
    await admin.getByLabel("SKU variante 1").fill(`XSS-${id}`.toUpperCase());
    await admin.getByLabel("Stock variante 1").fill("1");
    await admin.getByRole("button", { name: "Crear producto" }).click();
    await admin.waitForURL((u) => /^\/admin\/productos\/[a-z0-9]{20,}$/.test(u.pathname));
    await context.close();

    page.on("dialog", (d) => {
      throw new Error(`Diálogo inesperado: ${d.message()}`);
    });
    await page.goto(`/productos/gorro-xss-${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name); // se muestra como texto
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    const product = (await jsonLdBlocks(page)).find((b) => b["@type"] === "Product");
    expect(product.name).toBe(name); // el JSON-LD sigue siendo válido y conserva el texto
  });
});
