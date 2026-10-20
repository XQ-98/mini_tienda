import { ImageResponse } from "next/og";

import { formatUSD } from "@/lib/domain/money";
import { getProductBySlug } from "@/server/queries/catalog";
import { getStoreSettings } from "@/server/queries/settings";
import { ogImageSource } from "@/server/seo/og-image";

// Imagen al compartir un producto: foto, nombre y precio. Así el enlace en
// WhatsApp ya muestra lo que el cliente quiere ver.
export const alt = "Producto de la tienda";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, store] = await Promise.all([getProductBySlug(slug), getStoreSettings()]);
  const photo = await ogImageSource(product?.images[0]?.url);
  const onSale = product?.compareAtPrice != null && product.compareAtPrice > product.price;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#FBF8F3", color: "#2B211C" }}>
        <div style={{ display: "flex", width: 560, height: 630, background: "#F4EEE6", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image */}
          {photo && <img src={photo} width={560} height={630} alt="" style={{ objectFit: "cover" }} />}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "0 64px" }}>
          <div style={{ fontSize: 24, letterSpacing: 4, textTransform: "uppercase", color: "#7A6A5E" }}>
            {product?.category.name ?? store.storeName}
          </div>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1, marginTop: 16 }}>{product?.name ?? store.storeName}</div>
          {product && (
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 32 }}>
              <div style={{ fontSize: 56, fontWeight: 700, color: "#A9472C" }}>{formatUSD(product.price)}</div>
              {onSale && (
                <div style={{ fontSize: 32, marginLeft: 20, color: "#7A6A5E", textDecoration: "line-through" }}>
                  {formatUSD(product.compareAtPrice!)}
                </div>
              )}
            </div>
          )}
          <div style={{ display: "flex", marginTop: 48, paddingTop: 24, borderTop: "2px solid #E5DCCF", fontSize: 26, color: "#7A6A5E" }}>
            {store.storeName} · Envíos a todo el Ecuador
          </div>
        </div>
      </div>
    ),
    size,
  );
}
