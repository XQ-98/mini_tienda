// Genera las ilustraciones SVG de categorías y productos en /public/images.
// Son deterministas y se versionan en el repositorio: en producción no se generan.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CATEGORIES, PRODUCTS } from "./data";
import { garmentSvg } from "./placeholders";
import { categoryImagePath, productImagePath } from "./seed-db";

function write(publicPath: string, svg: string) {
  const abs = join(process.cwd(), "public", publicPath);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, svg);
}

export function writePlaceholderImages() {
  for (const [i, c] of CATEGORIES.entries()) {
    write(categoryImagePath(c.slug), garmentSvg({ kind: c.kind, color: c.color, variant: i }));
  }
  for (const [i, p] of PRODUCTS.entries()) {
    p.colors.forEach((color, n) => {
      write(productImagePath(p.slug, n + 1), garmentSvg({ kind: p.kind, color: color.hex, variant: i + n }));
    });
    if (p.colors.length === 1) {
      write(
        productImagePath(p.slug, "detalle"),
        garmentSvg({ kind: p.kind, color: p.colors[0].hex, variant: i, detail: true }),
      );
    }
  }
}
