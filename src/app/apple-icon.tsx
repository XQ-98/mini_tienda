import { ImageResponse } from "next/og";

// Ícono para "Agregar a pantalla de inicio" en iPhone (PNG; iOS no usa SVG).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><polyline points="4,13 9,8 14,13 18,8 23,13 28,8" fill="none" stroke="#FBF8F3" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M16 16 L20 20 L16 24 L12 20 Z" fill="#FBF8F3"/></svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#A9472C", alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image */}
        <img src={`data:image/svg+xml;base64,${Buffer.from(mark).toString("base64")}`} width={150} height={150} alt="" />
      </div>
    ),
    size,
  );
}
