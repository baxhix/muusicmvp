/**
 * Mock data para o sistema de fãs no mapa.
 *
 * Duas camadas:
 *  - REGULAR_FANS: muitos pontos espalhados em regiões (1x1px verde no zoom alto)
 *  - CLUSTERS:  agrupadores com onda pulsante (visíveis no zoom afastado)
 *      tipo "listening" → verde   (fãs ouvindo agora)
 *      tipo "event"     → laranja (show/evento acontecendo na região)
 */

// ─────────────────────────────────────────────────────────────────────────────
// REGULAR FANS — pontos pequenos espalhados em regiões povoadas
// ─────────────────────────────────────────────────────────────────────────────

type Region = { center: [number, number]; spread: number; density: number };

// Centros e spreads ajustados para ficarem dentro dos continentes (não jogam
// pontos no oceano). Spreads pequenos + centros ligeiramente afastados da
// costa garantem que a maior parte dos pontos cai em terra firme.
const REGIONS: Region[] = [
  { center: [-48.0, -18.0], spread: 7,  density: 70 }, // BR sudeste/centro-oeste (interior)
  { center: [-39.5, -10.5], spread: 4,  density: 35 }, // BR nordeste interior
  { center: [-50.0, -27.0], spread: 4,  density: 28 }, // BR sul (PR/SC/RS)
  { center: [-95.0, 38.0],  spread: 14, density: 65 }, // EUA central
  { center: [-77.0, 40.0],  spread: 5,  density: 25 }, // EUA leste
  { center: [-119.0, 38.0], spread: 6,  density: 20 }, // EUA oeste
  { center: [10.0, 50.0],   spread: 9,  density: 60 }, // Europa central
  { center: [22.0, 52.0],   spread: 7,  density: 35 }, // Europa oriental
  { center: [-3.0, 40.0],   spread: 4,  density: 22 }, // Ibérica
  { center: [108.0, 32.0],  spread: 11, density: 55 }, // China central/leste
  { center: [137.0, 36.0],  spread: 3,  density: 18 }, // Japão
  { center: [78.0, 23.0],   spread: 8,  density: 35 }, // Índia
  { center: [105.0, 14.0],  spread: 5,  density: 18 }, // Sudeste asiático mainland
  { center: [22.0, 8.0],    spread: 12, density: 28 }, // África central
  { center: [27.0, -25.0],  spread: 8,  density: 18 }, // África austral
  { center: [134.0, -25.0], spread: 8,  density: 22 }, // Austrália interior
  { center: [55.0, 60.0],   spread: 18, density: 30 }, // Rússia siberiana
];

/**
 * Bboxes aproximadas dos principais blocos continentais.
 * Um ponto fora de TODAS as bboxes é considerado oceano e descartado.
 * Sobreposição é OK — usamos como filtro permissivo de terra.
 */
const LAND_BBOXES: ReadonlyArray<readonly [number, number, number, number]> = [
  // [west, south, east, north]
  // ── América do Sul
  [-72, -37, -34, 12],   // Brasil + Bolívia + Paraguai + Argentina norte
  [-78, -56, -65, -36],  // Cone sul (Chile/Argentina)
  // ── América do Norte
  [-125, 32, -75, 50],   // EUA continental
  [-141, 50, -65, 70],   // Canadá
  [-117, 14, -86, 32],   // México
  [-92, 8, -77, 18],     // América Central
  // ── Europa
  [-10, 36, 30, 60],     // Europa ocidental/central
  [22, 35, 45, 60],      // Europa oriental + Bálcãs
  [22, 50, 180, 75],     // Rússia + norte da Europa
  // ── África
  [-18, -35, 12, 35],    // África ocidental
  [12, -35, 51, 35],     // África oriental/austral
  // ── Oriente Médio
  [33, 12, 60, 42],      // Levante + Arábia
  // ── Ásia
  [60, 24, 105, 55],     // Ásia central
  [73, 6, 90, 35],       // Índia
  [88, 6, 110, 28],      // Sudeste asiático mainland
  [97, 1, 110, 23],      // Mekong / Vietnã
  [105, 18, 135, 53],    // China leste + Coreia
  [128, 30, 146, 46],    // Japão
  [95, -10, 141, 8],     // Indonésia ilhas
  [115, -11, 142, 3],    // Indonésia oriental + Papua
  [117, 5, 127, 19],     // Filipinas
  // ── Oceania
  [113, -39, 154, -11],  // Austrália
  [165, -48, 179, -34],  // Nova Zelândia
];

function isOnLand(lng: number, lat: number): boolean {
  for (const [w, s, e, n] of LAND_BBOXES) {
    if (lng >= w && lng <= e && lat >= s && lat <= n) return true;
  }
  return false;
}

function generateFanCoords(): [number, number][] {
  // Seeded deterministic pseudo-random — same set every reload
  let seed = 0xC0FFEE;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xFFFFFFFF;
  };
  const points: [number, number][] = [];
  for (const { center, spread, density } of REGIONS) {
    let placed = 0;
    let attempts = 0;
    while (placed < density && attempts < density * 6) {
      attempts++;
      const dx = ((rand() + rand()) - 1) * spread;
      const dy = ((rand() + rand()) - 1) * spread;
      const lng = center[0] + dx;
      const lat = center[1] + dy;
      if (!isOnLand(lng, lat)) continue;
      points.push([lng, lat]);
      placed++;
    }
  }
  return points;
}

/**
 * Pontos concentrados ao redor das principais metrópoles globais.
 * Cidades costeiras estão ligeiramente deslocadas para o interior para que
 * o spread radial não jogue pontos no mar adjacente.
 */
const CITY_HOTSPOTS: [number, number][] = [
  // América do Sul
  [-46.6, -23.5], [-43.6, -22.7], [-43.9, -19.9], [-49.3, -25.4],
  [-38.9, -3.9], [-50.9, -29.8], [-58.2, -34.5], [-70.4, -33.4],
  // América do Norte
  [-74.3, 40.9], [-118.0, 34.2], [-87.6, 41.8], [-80.5, 26.0],
  [-122.0, 37.7], [-71.4, 42.5], [-99.1, 19.4],
  // Europa (Lisboa, Madrid, Atenas, etc. — todas inland-shifted)
  [2.3, 48.8], [-0.1, 51.5], [13.4, 52.5], [12.5, 41.9],
  [-3.7, 40.4], [-9.0, 38.9], [-4.4, 37.4], [4.9, 52.2],
  // Ásia leste (cidades portuárias deslocadas inland)
  [139.5, 35.7], [116.4, 39.9], [121.2, 31.2], [113.0, 23.1],
  [127.0, 37.6], [121.4, 24.9],
  // Sudeste asiático
  [103.8, 1.3], [106.8, -6.2], [100.5, 13.7], [120.9, 14.6],
  // Sul da Ásia
  [73.0, 19.1], [77.2, 28.6], [88.4, 22.6],
  // Rússia
  [37.6, 55.7], [30.4, 59.9],
  // África
  [3.4, 6.5], [31.2, 30.0], [36.8, -1.3], [18.7, -33.7],
  [-7.6, 33.6], [32.6, 15.6],
  // Oceania
  [151.0, -33.7], [144.9, -37.8], [174.6, -36.7],
  // Oriente Médio
  [55.1, 25.2], [46.7, 24.7], [35.2, 31.8],
];

function generateCityClusterDots(): [number, number][] {
  let seed = 0xC17C175;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xFFFFFFFF;
  };
  const out: [number, number][] = [];
  for (const [lng, lat] of CITY_HOTSPOTS) {
    // ~30 pontos por cidade num raio de ~0.6° (≈ 65 km) — bem inland
    const target = 28 + Math.floor(rand() * 12);
    let placed = 0;
    let attempts = 0;
    while (placed < target && attempts < target * 8) {
      attempts++;
      const dx = ((rand() + rand()) - 1) * 0.6;
      const dy = ((rand() + rand()) - 1) * 0.6;
      const newLng = lng + dx;
      const newLat = lat + dy;
      if (!isOnLand(newLng, newLat)) continue;
      out.push([newLng, newLat]);
      placed++;
    }
  }
  return out;
}

const CITY_CLUSTER_DOTS = generateCityClusterDots();

export const REGULAR_FANS: [number, number][] = [
  ...generateFanCoords(),
  ...CITY_CLUSTER_DOTS,
];

// ─────────────────────────────────────────────────────────────────────────────
// CLUSTERS — agrupadores com onda pulsante no zoom afastado
// ─────────────────────────────────────────────────────────────────────────────

export type ClusterType = 'listening' | 'event';

export type Cluster = {
  id: string;
  type: ClusterType;
  center: [number, number];
  count: number;
  city: string;
  detail?: string;
};

/**
 * Uma onda pulsante por continente. À medida que o zoom avança, a onda fica
 * menor (controlado pelo CSS `--ring-base-size`) e os pontos verdes começam a
 * aparecer espalhados pelo mapa (camada `fan-dots-tiny` com opacity-by-zoom).
 */
export const CLUSTERS: Cluster[] = [
  { id: 'sam', type: 'listening', center: [-58, -15],  count: 89000,  city: 'América do Sul' },
  { id: 'nam', type: 'listening', center: [-100, 42],  count: 124000, city: 'América do Norte' },
  { id: 'eu',  type: 'listening', center: [12, 50],    count: 98500,  city: 'Europa' },
  { id: 'as',  type: 'listening', center: [95, 38],    count: 165000, city: 'Ásia' },
  { id: 'af',  type: 'listening', center: [20, 2],     count: 32000,  city: 'África' },
  { id: 'oc',  type: 'listening', center: [135, -25],  count: 12500,  city: 'Oceania' },
];

// ─────────────────────────────────────────────────────────────────────────────
// CITY HUBS — badges "+N" agrupando usuários no zoom máximo
// ─────────────────────────────────────────────────────────────────────────────

export type CityHub = {
  id: string;
  coords: [number, number];
  count: number;
};

export const CITY_HUBS: CityHub[] = [
  // São Paulo — distribuídos pelos quatro cantos + centro da cidade
  { id: 'sp-paulista', coords: [-46.6553, -23.5613], count: 892 }, // Centro / Av. Paulista
  { id: 'sp-norte',    coords: [-46.6210, -23.4960], count: 412 }, // Zona Norte / Santana
  { id: 'sp-sul',      coords: [-46.6440, -23.6230], count: 455 }, // Zona Sul / Saúde
  { id: 'sp-leste',    coords: [-46.5762, -23.5400], count: 318 }, // Zona Leste / Tatuapé
  { id: 'sp-oeste',    coords: [-46.6810, -23.5670], count: 624 }, // Zona Oeste / Pinheiros
  // Rio de Janeiro
  { id: 'rj-zona-sul',  coords: [-43.1923, -22.9707], count: 521 },
  { id: 'rj-centro',    coords: [-43.1729, -22.9068], count: 412 },
  { id: 'rj-tijuca',    coords: [-43.2330, -22.9265], count: 287 },
  // Belo Horizonte
  { id: 'bh-centro',    coords: [-43.9352, -19.9208], count: 364 },
  // Curitiba
  { id: 'ctb-batel',    coords: [-49.2845, -25.4378], count: 245 },
  // Fortaleza
  { id: 'for-meireles', coords: [-38.4953, -3.7280],  count: 401 },
  // Porto Alegre
  { id: 'poa-centro',   coords: [-51.2300, -30.0346], count: 278 },
  // Brasília
  { id: 'bsb-asa-sul',  coords: [-47.9100, -15.8200], count: 358 },
  // Recife
  { id: 'rec-boa-vista',coords: [-34.8910, -8.0620],  count: 312 },
  // Buenos Aires
  { id: 'ba-palermo',   coords: [-58.4280, -34.5870], count: 489 },
  // Lisboa
  { id: 'ls-baixa',     coords: [-9.1393, 38.7223],   count: 367 },
  // Madrid
  { id: 'md-centro',    coords: [-3.7038, 40.4168],   count: 298 },
  // Paris
  { id: 'pa-marais',    coords: [2.3635, 48.8581],    count: 412 },
  // London
  { id: 'ln-soho',      coords: [-0.1335, 51.5142],   count: 354 },
  // New York
  { id: 'ny-times',     coords: [-73.9857, 40.7549],  count: 580 },
  { id: 'ny-brooklyn',  coords: [-73.9442, 40.6782],  count: 423 },
  // Tokyo
  { id: 'tk-shibuya',   coords: [139.7016, 35.6580],  count: 467 },
  { id: 'tk-shinjuku',  coords: [139.7036, 35.6938],  count: 389 },
  // Mexico City
  { id: 'mx-centro',    coords: [-99.1332, 19.4326],  count: 334 },
];

/** Formata count como +N ou +1.2k */
export function formatHubCount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `+${k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `+${n}`;
}

/** Formata número grande como "+89k", "+165k" para badges de continente */
export function formatContinentCount(n: number): string {
  if (n >= 1000000) return `+${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000)    return `+${Math.floor(n / 1000)}k`;
  return `+${n}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBE DOTS — ~70 pontos esparsos globais para movimento sutil em zoom out
// ─────────────────────────────────────────────────────────────────────────────

/** Subconjunto de REGULAR_FANS — 70 pontos representativos para o globo. */
export const GLOBE_DOTS: [number, number][] = (() => {
  const step = Math.max(1, Math.floor(REGULAR_FANS.length / 70));
  const out: [number, number][] = [];
  for (let i = 0; i < REGULAR_FANS.length && out.length < 70; i += step) {
    out.push(REGULAR_FANS[i]);
  }
  return out;
})();
