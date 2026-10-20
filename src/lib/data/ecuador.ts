// Provincias y cantones del Ecuador (división político-administrativa del INEC):
// 24 provincias y 221 cantones.

export type Region = "Sierra" | "Costa" | "Amazonía" | "Insular";

export interface Province {
  code: string;
  name: string;
  region: Region;
  cantons: readonly string[];
}

export const PROVINCES: readonly Province[] = [
  {
    code: "01",
    name: "Azuay",
    region: "Sierra",
    cantons: [
      "Cuenca", "Camilo Ponce Enríquez", "Chordeleg", "El Pan", "Girón", "Guachapala", "Gualaceo",
      "Nabón", "Oña", "Paute", "Pucará", "San Fernando", "Santa Isabel", "Sevilla de Oro", "Sígsig",
    ],
  },
  {
    code: "02",
    name: "Bolívar",
    region: "Sierra",
    cantons: ["Guaranda", "Caluma", "Chillanes", "Chimbo", "Echeandía", "Las Naves", "San Miguel"],
  },
  {
    code: "03",
    name: "Cañar",
    region: "Sierra",
    cantons: ["Azogues", "Biblián", "Cañar", "Déleg", "El Tambo", "La Troncal", "Suscal"],
  },
  {
    code: "04",
    name: "Carchi",
    region: "Sierra",
    cantons: ["Tulcán", "Bolívar", "Espejo", "Mira", "Montúfar", "San Pedro de Huaca"],
  },
  {
    code: "05",
    name: "Cotopaxi",
    region: "Sierra",
    cantons: ["Latacunga", "La Maná", "Pangua", "Pujilí", "Salcedo", "Saquisilí", "Sigchos"],
  },
  {
    code: "06",
    name: "Chimborazo",
    region: "Sierra",
    cantons: [
      "Riobamba", "Alausí", "Chambo", "Chunchi", "Colta", "Cumandá", "Guamote", "Guano", "Pallatanga", "Penipe",
    ],
  },
  {
    code: "07",
    name: "El Oro",
    region: "Costa",
    cantons: [
      "Machala", "Arenillas", "Atahualpa", "Balsas", "Chilla", "El Guabo", "Huaquillas", "Las Lajas",
      "Marcabelí", "Pasaje", "Piñas", "Portovelo", "Santa Rosa", "Zaruma",
    ],
  },
  {
    code: "08",
    name: "Esmeraldas",
    region: "Costa",
    cantons: ["Esmeraldas", "Atacames", "Eloy Alfaro", "Muisne", "Quinindé", "Rioverde", "San Lorenzo"],
  },
  {
    code: "09",
    name: "Guayas",
    region: "Costa",
    cantons: [
      "Guayaquil", "Alfredo Baquerizo Moreno (Jujan)", "Balao", "Balzar", "Colimes", "Coronel Marcelino Maridueña",
      "Daule", "Durán", "El Empalme", "El Triunfo", "General Antonio Elizalde (Bucay)", "Isidro Ayora",
      "Lomas de Sargentillo", "Milagro", "Naranjal", "Naranjito", "Nobol", "Palestina", "Pedro Carbo", "Playas",
      "Salitre", "Samborondón", "San Jacinto de Yaguachi", "Santa Lucía", "Simón Bolívar",
    ],
  },
  {
    code: "10",
    name: "Imbabura",
    region: "Sierra",
    cantons: ["Ibarra", "Antonio Ante", "Cotacachi", "Otavalo", "Pimampiro", "San Miguel de Urcuquí"],
  },
  {
    code: "11",
    name: "Loja",
    region: "Sierra",
    cantons: [
      "Loja", "Calvas", "Catamayo", "Celica", "Chaguarpamba", "Espíndola", "Gonzanamá", "Macará", "Olmedo",
      "Paltas", "Pindal", "Puyango", "Quilanga", "Saraguro", "Sozoranga", "Zapotillo",
    ],
  },
  {
    code: "12",
    name: "Los Ríos",
    region: "Costa",
    cantons: [
      "Babahoyo", "Baba", "Buena Fe", "Mocache", "Montalvo", "Palenque", "Puebloviejo", "Quevedo", "Quinsaloma",
      "Urdaneta", "Valencia", "Ventanas", "Vinces",
    ],
  },
  {
    code: "13",
    name: "Manabí",
    region: "Costa",
    cantons: [
      "Portoviejo", "24 de Mayo", "Bolívar", "Chone", "El Carmen", "Flavio Alfaro", "Jama", "Jaramijó", "Jipijapa",
      "Junín", "Manta", "Montecristi", "Olmedo", "Paján", "Pedernales", "Pichincha", "Puerto López", "Rocafuerte",
      "San Vicente", "Santa Ana", "Sucre", "Tosagua",
    ],
  },
  {
    code: "14",
    name: "Morona Santiago",
    region: "Amazonía",
    cantons: [
      "Morona", "Gualaquiza", "Huamboya", "Limón Indanza", "Logroño", "Pablo Sexto", "Palora", "San Juan Bosco",
      "Santiago", "Sucúa", "Taisha", "Tiwintza",
    ],
  },
  {
    code: "15",
    name: "Napo",
    region: "Amazonía",
    cantons: ["Tena", "Archidona", "Carlos Julio Arosemena Tola", "El Chaco", "Quijos"],
  },
  {
    code: "16",
    name: "Pastaza",
    region: "Amazonía",
    cantons: ["Pastaza (Puyo)", "Arajuno", "Mera", "Santa Clara"],
  },
  {
    code: "17",
    name: "Pichincha",
    region: "Sierra",
    cantons: [
      "Quito", "Cayambe", "Mejía", "Pedro Moncayo", "Pedro Vicente Maldonado", "Puerto Quito", "Rumiñahui",
      "San Miguel de los Bancos",
    ],
  },
  {
    code: "18",
    name: "Tungurahua",
    region: "Sierra",
    cantons: [
      "Ambato", "Baños de Agua Santa", "Cevallos", "Mocha", "Patate", "Quero", "San Pedro de Pelileo",
      "Santiago de Píllaro", "Tisaleo",
    ],
  },
  {
    code: "19",
    name: "Zamora Chinchipe",
    region: "Amazonía",
    cantons: [
      "Zamora", "Centinela del Cóndor", "Chinchipe", "El Pangui", "Nangaritza", "Palanda", "Paquisha",
      "Yacuambi", "Yantzaza",
    ],
  },
  {
    code: "20",
    name: "Galápagos",
    region: "Insular",
    cantons: ["San Cristóbal", "Isabela", "Santa Cruz"],
  },
  {
    code: "21",
    name: "Sucumbíos",
    region: "Amazonía",
    cantons: ["Lago Agrio", "Cascales", "Cuyabeno", "Gonzalo Pizarro", "Putumayo", "Shushufindi", "Sucumbíos"],
  },
  {
    code: "22",
    name: "Orellana",
    region: "Amazonía",
    cantons: ["Francisco de Orellana (Coca)", "Aguarico", "La Joya de los Sachas", "Loreto"],
  },
  {
    code: "23",
    name: "Santo Domingo de los Tsáchilas",
    region: "Costa",
    cantons: ["Santo Domingo", "La Concordia"],
  },
  {
    code: "24",
    name: "Santa Elena",
    region: "Costa",
    cantons: ["Santa Elena", "La Libertad", "Salinas"],
  },
];

export function getProvince(code: string): Province | undefined {
  return PROVINCES.find((p) => p.code === code);
}

export function isValidCanton(provinceCode: string, canton: string): boolean {
  return getProvince(provinceCode)?.cantons.includes(canton) ?? false;
}
