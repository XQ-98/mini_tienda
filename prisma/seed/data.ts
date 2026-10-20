import type { GarmentKind } from "./placeholders";

export interface SeedCategory {
  slug: string;
  name: string;
  description: string;
  kind: GarmentKind;
  color: string;
}

export interface SeedProduct {
  name: string;
  slug: string;
  category: string;
  kind: GarmentKind;
  price: number; // dólares, PVP con IVA incluido
  compareAt?: number;
  featured?: boolean;
  description: string;
  sizes: string[];
  colors: { name: string; hex: string }[];
}

export const CATEGORIES: SeedCategory[] = [
  {
    slug: "ponchos-y-abrigos",
    name: "Ponchos y abrigos",
    description: "Ponchos, chaquetas y cárdigans tejidos en lana de oveja y alpaca.",
    kind: "poncho",
    color: "#8C5A3C",
  },
  {
    slug: "blusas-y-camisas",
    name: "Blusas y camisas",
    description: "Blusas bordadas a mano y camisas de lino para el día a día.",
    kind: "camisa",
    color: "#F7F3EA",
  },
  {
    slug: "vestidos-y-faldas",
    name: "Vestidos y faldas",
    description: "Vestidos bordados y anacos plisados inspirados en la vestimenta kichwa.",
    kind: "vestido",
    color: "#2B2B2B",
  },
  {
    slug: "sombreros",
    name: "Sombreros",
    description: "Sombreros de paja toquilla tejidos en Montecristi y Sígsig.",
    kind: "sombrero",
    color: "#D9C49A",
  },
  {
    slug: "bolsos-y-accesorios",
    name: "Bolsos y accesorios",
    description: "Bolsos de cabuya, mochilas y artículos de cuero con detalles tejidos.",
    kind: "bolso",
    color: "#B5452B",
  },
  {
    slug: "bufandas-y-chalinas",
    name: "Bufandas y chalinas",
    description: "Bufandas, chalinas y sets de alpaca para el frío de la sierra.",
    kind: "bufanda",
    color: "#7A8B99",
  },
];

const C = {
  gris: { name: "Gris", hex: "#8A8D91" },
  camel: { name: "Camel", hex: "#B98A5E" },
  negro: { name: "Negro", hex: "#2B2B2B" },
  rojo: { name: "Rojo", hex: "#A8322D" },
  azulMarino: { name: "Azul marino", hex: "#1F3A5F" },
  cafe: { name: "Café", hex: "#6B4A35" },
  beige: { name: "Beige", hex: "#D8C7AE" },
  blanco: { name: "Blanco", hex: "#F7F3EA" },
  crema: { name: "Crema", hex: "#EFE3C8" },
  arena: { name: "Arena", hex: "#CDBB9C" },
  azul: { name: "Azul", hex: "#4A6FA5" },
  celeste: { name: "Celeste", hex: "#A9C7E3" },
  terracota: { name: "Terracota", hex: "#B5583A" },
  oliva: { name: "Verde oliva", hex: "#6B7244" },
  natural: { name: "Natural", hex: "#D9C49A" },
  vino: { name: "Vino", hex: "#6E2433" },
  multicolor: { name: "Multicolor", hex: "#C4573A" },
};

const TALLAS = ["S", "M", "L", "XL"];
const SOMBRERO = ["55 cm", "56 cm", "57 cm", "58 cm"];
const UNICA = ["Única"];

export const PRODUCTS: SeedProduct[] = [
  // ── Ponchos y abrigos ──
  {
    name: "Poncho de alpaca Cotacachi",
    slug: "poncho-alpaca-cotacachi",
    category: "ponchos-y-abrigos",
    kind: "poncho",
    price: 68,
    compareAt: 79,
    featured: true,
    description:
      "Poncho tejido en telar de pedal con mezcla de lana de alpaca, suave y abrigador. Cada pieza lleva una banda de rombos que identifica a los talleres de Cotacachi. Talla única que se adapta a todo tipo de cuerpo.",
    sizes: UNICA,
    colors: [C.gris, C.camel, C.negro],
  },
  {
    name: "Poncho tejido Imbabura",
    slug: "poncho-tejido-imbabura",
    category: "ponchos-y-abrigos",
    kind: "poncho",
    price: 55,
    description:
      "Poncho tradicional de lana de oveja con flecos anudados a mano. Su tejido doble lo hace ideal para las noches frías de la sierra.",
    sizes: UNICA,
    colors: [C.rojo, C.azulMarino],
  },
  {
    name: "Chaqueta de lana con capucha",
    slug: "chaqueta-lana-capucha",
    category: "ponchos-y-abrigos",
    kind: "poncho",
    price: 45,
    description:
      "Chaqueta tejida en lana de oveja con capucha y bolsillos frontales. Forro interior de algodón para mayor comodidad.",
    sizes: TALLAS,
    colors: [C.gris, C.cafe],
  },
  {
    name: "Cárdigan de alpaca",
    slug: "cardigan-alpaca",
    category: "ponchos-y-abrigos",
    kind: "poncho",
    price: 52,
    featured: true,
    description:
      "Cárdigan liviano de alpaca con botones de tagua, la semilla conocida como marfil vegetal. Perfecto para usar en capas.",
    sizes: ["S", "M", "L"],
    colors: [C.beige, C.gris],
  },

  // ── Blusas y camisas ──
  {
    name: "Blusa bordada otavaleña",
    slug: "blusa-bordada-otavalena",
    category: "blusas-y-camisas",
    kind: "camisa",
    price: 32,
    featured: true,
    description:
      "Blusa de algodón con bordado floral hecho a mano por artesanas de Otavalo. El bordado puede variar ligeramente entre piezas: cada una es única.",
    sizes: ["S", "M", "L"],
    colors: [C.blanco, C.crema],
  },
  {
    name: "Camisa de lino unisex",
    slug: "camisa-lino-unisex",
    category: "blusas-y-camisas",
    kind: "camisa",
    price: 38,
    featured: true,
    description:
      "Camisa de lino fresco con corte recto y cuello clásico. Ideal para la costa o los días soleados de la sierra.",
    sizes: TALLAS,
    colors: [C.blanco, C.arena, C.azul],
  },
  {
    name: "Blusa de algodón Zuleta",
    slug: "blusa-algodon-zuleta",
    category: "blusas-y-camisas",
    kind: "camisa",
    price: 36,
    compareAt: 42,
    description:
      "Inspirada en los bordados de la comunidad de Zuleta, con motivos de flores y aves en el cuello y los puños.",
    sizes: ["S", "M", "L"],
    colors: [C.blanco],
  },
  {
    name: "Guayabera de lino",
    slug: "guayabera-lino",
    category: "blusas-y-camisas",
    kind: "camisa",
    price: 42,
    description:
      "Guayabera de lino con alforzas verticales y cuatro bolsillos. Elegante para eventos de día.",
    sizes: ["M", "L", "XL"],
    colors: [C.blanco, C.celeste],
  },

  // ── Vestidos y faldas ──
  {
    name: "Vestido bordado a mano",
    slug: "vestido-bordado-a-mano",
    category: "vestidos-y-faldas",
    kind: "vestido",
    price: 58,
    featured: true,
    description:
      "Vestido de algodón con bordado en el escote y el ruedo, hecho a mano en un proceso de más de diez horas por pieza.",
    sizes: ["S", "M", "L"],
    colors: [C.blanco, C.negro],
  },
  {
    name: "Falda anaco plisada",
    slug: "falda-anaco-plisada",
    category: "vestidos-y-faldas",
    kind: "vestido",
    price: 40,
    description:
      "Falda inspirada en el anaco tradicional, con pliegues finos y faja tejida en la cintura.",
    sizes: ["S", "M", "L"],
    colors: [C.negro, C.azulMarino],
  },
  {
    name: "Vestido largo de lino",
    slug: "vestido-largo-lino",
    category: "vestidos-y-faldas",
    kind: "vestido",
    price: 62,
    compareAt: 70,
    description:
      "Vestido largo de lino con tirantes ajustables y una banda tejida en la cintura. Fresco y versátil.",
    sizes: ["S", "M", "L"],
    colors: [C.terracota, C.oliva],
  },

  // ── Sombreros ──
  {
    name: "Sombrero de paja toquilla Montecristi",
    slug: "sombrero-paja-toquilla-montecristi",
    category: "sombreros",
    kind: "sombrero",
    price: 95,
    featured: true,
    description:
      "Sombrero fino tejido a mano en Montecristi con paja toquilla. El tejido de paja toquilla es Patrimonio Cultural Inmaterial de la Humanidad (UNESCO). Incluye caja de cartón para transporte.",
    sizes: SOMBRERO,
    colors: [C.natural],
  },
  {
    name: "Sombrero Panamá clásico",
    slug: "sombrero-panama-clasico",
    category: "sombreros",
    kind: "sombrero",
    price: 45,
    description:
      "El clásico sombrero de paja toquilla, tejido en Sígsig, con cinta de grosgrain negra. Liviano y flexible.",
    sizes: SOMBRERO,
    colors: [C.natural, C.blanco],
  },
  {
    name: "Sombrero fedora de paja",
    slug: "sombrero-fedora-paja",
    category: "sombreros",
    kind: "sombrero",
    price: 38,
    description:
      "Fedora de ala corta en paja toquilla, con cinta tejida en colores andinos.",
    sizes: ["56 cm", "57 cm", "58 cm"],
    colors: [C.natural],
  },

  // ── Bolsos y accesorios ──
  {
    name: "Bolso tejido de cabuya",
    slug: "bolso-tejido-cabuya",
    category: "bolsos-y-accesorios",
    kind: "bolso",
    price: 28,
    featured: true,
    description:
      "Bolso tejido con fibra de cabuya natural, resistente y liviano. Forro interior con cierre.",
    sizes: UNICA,
    colors: [C.natural, C.multicolor],
  },
  {
    name: "Mochila de lona con tejido andino",
    slug: "mochila-lona-tejido-andino",
    category: "bolsos-y-accesorios",
    kind: "bolso",
    price: 34,
    description:
      "Mochila de lona con paneles de tejido andino y correas acolchadas. Compartimento para laptop de hasta 14 pulgadas.",
    sizes: UNICA,
    colors: [C.rojo, C.azul],
  },
  {
    name: "Billetera de cuero con detalle tejido",
    slug: "billetera-cuero-detalle-tejido",
    category: "bolsos-y-accesorios",
    kind: "bolso",
    price: 18,
    description:
      "Billetera de cuero curtido en Cotacachi con un panel de tejido artesanal. Seis ranuras para tarjetas.",
    sizes: UNICA,
    colors: [C.cafe, C.negro],
  },

  // ── Bufandas y chalinas ──
  {
    name: "Bufanda de alpaca",
    slug: "bufanda-alpaca",
    category: "bufandas-y-chalinas",
    kind: "bufanda",
    price: 24,
    compareAt: 29,
    featured: true,
    description:
      "Bufanda de alpaca suave al tacto, sin la picazón de la lana común. 180 cm de largo con flecos.",
    sizes: UNICA,
    colors: [C.gris, C.camel, C.vino],
  },
  {
    name: "Chalina tejida a mano",
    slug: "chalina-tejida-a-mano",
    category: "bufandas-y-chalinas",
    kind: "bufanda",
    price: 30,
    description:
      "Chalina amplia tejida en telar de cintura, con franjas de colores inspiradas en los paisajes de Imbabura.",
    sizes: UNICA,
    colors: [C.multicolor, C.azul],
  },
  {
    name: "Set de gorro y guantes de alpaca",
    slug: "set-gorro-guantes-alpaca",
    category: "bufandas-y-chalinas",
    kind: "bufanda",
    price: 26,
    description:
      "Set de gorro y guantes tejidos en alpaca. Un regalo práctico para quien viaja a la sierra.",
    sizes: UNICA,
    colors: [C.gris, C.negro],
  },
];
