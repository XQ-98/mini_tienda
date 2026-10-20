import { ImageResponse } from "next/og";

import { getStoreSettings } from "@/server/queries/settings";

// Imagen que aparece al compartir la tienda en WhatsApp, Facebook o X.
export const alt = "Tienda en línea de ropa y accesorios tejidos a mano";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const zigzag = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="48"><polyline points="${Array.from(
  { length: 51 },
  (_, i) => `${i * 24},${i % 2 ? 8 : 40}`,
).join(" ")}" fill="none" stroke="#F4EEE6" stroke-width="5" stroke-opacity="0.55"/></svg>`;

export default async function Image() {
  const store = await getStoreSettings();
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#A9472C", color: "#FBF8F3" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "0 90px" }}>
          <div style={{ fontSize: 28, letterSpacing: 6, textTransform: "uppercase", opacity: 0.85 }}>Hecho a mano en Ecuador</div>
          <div style={{ fontSize: 112, fontWeight: 700, marginTop: 12, lineHeight: 1 }}>{store.storeName}</div>
          {store.tagline && <div style={{ fontSize: 40, marginTop: 28, maxWidth: 900, opacity: 0.92 }}>{store.tagline}</div>}
          <div style={{ fontSize: 28, marginTop: 40, opacity: 0.8 }}>Envíos a todo el Ecuador · Tarjeta o transferencia</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image */}
        <img src={`data:image/svg+xml;base64,${Buffer.from(zigzag).toString("base64")}`} width={1200} height={48} alt="" style={{ marginBottom: 36 }} />
      </div>
    ),
    size,
  );
}
