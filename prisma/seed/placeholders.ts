// Genera ilustraciones SVG de las prendas para usarlas como imágenes de
// ejemplo. Son deterministas: el mismo producto/color produce el mismo archivo.

export type GarmentKind = "poncho" | "camisa" | "vestido" | "sombrero" | "bolso" | "bufanda";

const BACKGROUNDS = ["#F4EEE6", "#EEE6DA", "#F1ECE6", "#EAE4DC"];
const ACCENTS = ["#B5452B", "#2F5D62", "#D9A441", "#5B3E8C", "#1F3A5F"];

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const f = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const r = clamp(((n >> 16) & 255) + (f - ((n >> 16) & 255)) * t);
  const g = clamp(((n >> 8) & 255) + (f - ((n >> 8) & 255)) * t);
  const b = clamp((n & 255) + (f - (n & 255)) * t);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 170;
}

/** Banda en zigzag, el motivo andino que decora las prendas. */
function zigzag(x1: number, x2: number, y: number, color: string, amp = 14, step = 22, width = 6) {
  const pts: string[] = [];
  for (let x = x1, up = true; x <= x2; x += step, up = !up) {
    pts.push(`${x},${up ? y - amp : y + amp}`);
  }
  return `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

function diamonds(x1: number, x2: number, y: number, color: string, size = 14, gap = 40) {
  let out = "";
  for (let x = x1; x <= x2; x += gap) {
    out += `<path d="M${x} ${y - size} L${x + size} ${y} L${x} ${y + size} L${x - size} ${y} Z" fill="${color}"/>`;
  }
  return out;
}

function fringe(x1: number, x2: number, y: number, len: number, color: string) {
  let out = "";
  for (let x = x1; x <= x2; x += 16) {
    out += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + len}" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`;
  }
  return out;
}

function garment(kind: GarmentKind, fill: string, accent: string): string {
  const dark = shade(fill, -0.25);
  const trim = isLight(fill) ? accent : shade(fill, 0.55);

  switch (kind) {
    case "poncho":
      return `
        <path d="M290 210 L510 210 L730 640 L570 810 L230 810 L70 640 Z" fill="${fill}"/>
        <path d="M290 210 L510 210 L730 640 L570 810 L230 810 L70 640 Z" fill="none" stroke="${dark}" stroke-width="6"/>
        <ellipse cx="400" cy="222" rx="80" ry="30" fill="${dark}"/>
        ${zigzag(150, 650, 560, trim, 16, 26, 8)}
        ${diamonds(170, 640, 620, trim, 10, 40)}
        ${zigzag(150, 650, 680, trim, 16, 26, 8)}
        ${fringe(240, 560, 812, 40, dark)}`;
    case "camisa":
      return `
        <path d="M300 200 L230 222 L110 370 L200 432 L255 365 L255 830 L545 830 L545 365 L600 432 L690 370 L570 222 L500 200 Q400 275 300 200 Z" fill="${fill}" stroke="${dark}" stroke-width="6" stroke-linejoin="round"/>
        <path d="M300 200 Q400 275 500 200 L470 196 Q400 245 330 196 Z" fill="${dark}"/>
        ${zigzag(320, 480, 300, trim, 10, 20, 5)}
        ${diamonds(340, 470, 340, trim, 8, 26)}
        <line x1="400" y1="260" x2="400" y2="830" stroke="${dark}" stroke-width="3" stroke-dasharray="2 22"/>`;
    case "vestido":
      return `
        <line x1="345" y1="185" x2="335" y2="120" stroke="${dark}" stroke-width="10" stroke-linecap="round"/>
        <line x1="455" y1="185" x2="465" y2="120" stroke="${dark}" stroke-width="10" stroke-linecap="round"/>
        <path d="M330 180 Q400 215 470 180 L492 360 L650 850 L150 850 L308 360 Z" fill="${fill}" stroke="${dark}" stroke-width="6" stroke-linejoin="round"/>
        <rect x="306" y="350" width="188" height="22" fill="${dark}"/>
        ${zigzag(355, 445, 250, trim, 10, 18, 5)}
        ${zigzag(190, 610, 780, trim, 14, 24, 7)}
        ${diamonds(200, 600, 820, trim, 9, 36)}`;
    case "sombrero":
      return `
        <ellipse cx="400" cy="640" rx="310" ry="86" fill="${dark}"/>
        <ellipse cx="400" cy="626" rx="310" ry="86" fill="${fill}"/>
        <path d="M262 630 L282 400 Q292 322 400 322 Q508 322 518 400 L538 630 Z" fill="${fill}" stroke="${dark}" stroke-width="5"/>
        <path d="M400 330 Q392 380 400 420" stroke="${dark}" stroke-width="5" fill="none"/>
        <path d="M270 560 L530 560 L536 612 L264 612 Z" fill="${accent}"/>
        ${[0, 1, 2, 3].map((i) => `<ellipse cx="400" cy="626" rx="${150 + i * 40}" ry="${42 + i * 11}" fill="none" stroke="${dark}" stroke-width="2" opacity="0.35"/>`).join("")}`;
    case "bolso":
      return `
        <path d="M300 420 Q300 220 400 220 Q500 220 500 420" fill="none" stroke="${dark}" stroke-width="30" stroke-linecap="round"/>
        <rect x="210" y="400" width="380" height="400" rx="44" fill="${fill}" stroke="${dark}" stroke-width="6"/>
        ${zigzag(240, 560, 500, trim, 14, 24, 7)}
        ${diamonds(250, 550, 600, trim, 11, 40)}
        ${zigzag(240, 560, 700, trim, 14, 24, 7)}`;
    case "bufanda":
      return `
        <ellipse cx="400" cy="230" rx="150" ry="62" fill="none" stroke="${fill}" stroke-width="56"/>
        <path d="M290 250 L380 250 L380 800 L290 800 Z" fill="${fill}" stroke="${dark}" stroke-width="5"/>
        <path d="M420 270 L510 270 L510 740 L420 740 Z" fill="${shade(fill, -0.1)}" stroke="${dark}" stroke-width="5"/>
        ${[400, 520, 640, 760].map((y) => `<rect x="290" y="${y}" width="90" height="14" fill="${trim}"/>`).join("")}
        ${[380, 500, 620].map((y) => `<rect x="420" y="${y}" width="90" height="14" fill="${trim}"/>`).join("")}
        ${fringe(296, 376, 802, 40, dark)}
        ${fringe(426, 506, 742, 40, dark)}`;
  }
}

export function garmentSvg(opts: {
  kind: GarmentKind;
  color: string;
  variant?: number;
  detail?: boolean;
}): string {
  const v = opts.variant ?? 0;
  const bg = BACKGROUNDS[v % BACKGROUNDS.length];
  const accent = ACCENTS[(v + opts.color.length) % ACCENTS.length];
  // La vista "detalle" es un acercamiento al bordado.
  const transform = opts.detail ? `transform="translate(-400 -560) scale(2)"` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <rect width="800" height="1000" fill="${bg}"/>
  <ellipse cx="400" cy="900" rx="260" ry="26" fill="#000" opacity="0.06"/>
  <g ${transform}>${garment(opts.kind, opts.color, accent)}</g>
</svg>`;
}
