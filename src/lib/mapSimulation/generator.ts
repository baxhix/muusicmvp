/* ============================================================
 * MAP SIMULATION — Gerador determinístico de 10.000 mock users.
 *
 * Per feedback (com CSV distribuicao.csv anexado): "iremos simular
 * 10k de usuários online, distribuídos proporcionalmente pelas
 * cidades de acordo com o arquivo em anexo".
 *
 * Distribuição: cada cidade recebe
 *   `round(TOTAL_USERS × monthlyListeners / SUM_MONTHLY_LISTENERS)`
 * usuários, com resíduo redistribuído pelo top-list pra fechar
 * exatamente em TOTAL_USERS.
 *
 * Sample direto por cidade (não mais por região como antes).
 * Pra cada user, gaussiana ao redor do centro da cidade × sigmaKm.
 *
 * Determinístico (seed fixa) — re-runs produzem o mesmo dataset.
 * Cada mock user carrega `__simulated: true`.
 * ============================================================ */

import {
  CITY_SEEDS,
  SUM_MONTHLY_LISTENERS,
  TOTAL_USERS,
  type CitySeed,
  type Region,
} from './cities';

export type Tier = 'superfan' | 'top100' | 'top1000' | 'fan';

export interface MockUser {
  id: string;
  lng: number;
  lat: number;
  name: string;
  avatarSeed: number;        // 0..63 — índice no sprite atlas
  tier: Tier;
  /** Segundos atrás desde o "agora" mock (0 = online agora). */
  lastActiveSec: number;
  city: string;
  region: Region;
  /** Marker pra TODO downstream consumer: nunca tocar real data. */
  __simulated: true;
}

/* ── PRNG determinística (mulberry32) ────────────────────── */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller — converte 2 uniformes em 1 normal padrão. */
function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Converte km em graus de latitude (aprox 1° ≈ 111km). */
function kmToLat(km: number): number {
  return km / 111;
}
/** km em graus de longitude depende da latitude (cos shrinks polewards). */
function kmToLng(km: number, lat: number): number {
  return km / (111 * Math.cos((lat * Math.PI) / 180));
}

/* ── Distribuição de tiers ──────────────────────────────── */
/* Curva inspirada em comunidades reais: poucos superfãs no topo
 * + cauda longa de fans casuais. Soma = 1.0. */
const TIER_PROBS: { tier: Tier; p: number }[] = [
  { tier: 'superfan', p: 0.02 },   // ~140 superfãs / 7000
  { tier: 'top100',   p: 0.08 },   // ~560
  { tier: 'top1000',  p: 0.30 },   // ~2100
  { tier: 'fan',      p: 0.60 },   // ~4200
];

function sampleTier(rng: () => number): Tier {
  const r = rng();
  let acc = 0;
  for (const t of TIER_PROBS) {
    acc += t.p;
    if (r < acc) return t.tier;
  }
  return 'fan';
}

/* ── Recency (lastActiveSec) ──────────────────────────────
 * Bias forte pra "agora" — 60% < 5min, 30% < 1h, 10% < 1 dia.
 * Cria sensação de mapa fervilhando em tempo real.
 */
function sampleLastActive(rng: () => number): number {
  const r = rng();
  if (r < 0.6) return Math.floor(rng() * 300);                  // 0-5min
  if (r < 0.9) return 300 + Math.floor(rng() * (3600 - 300));   // 5-60min
  return 3600 + Math.floor(rng() * (86400 - 3600));             // 1h-24h
}

/* ── Quota proporcional de users por cidade ──────────────
 * Pré-calcula quantos users cada cidade recebe baseado em
 * monthlyListeners (do CSV) e TOTAL_USERS (10000). Resíduo da
 * rounding (até 50 users a distribuir) vai pras cidades com
 * maior fração decimal, garantindo soma exata = TOTAL_USERS. */
function computeUsersPerCity(): Array<{ city: CitySeed; count: number }> {
  type Entry = { city: CitySeed; raw: number; floor: number; frac: number };
  const entries: Entry[] = CITY_SEEDS.map((city) => {
    const raw = (TOTAL_USERS * city.monthlyListeners) / SUM_MONTHLY_LISTENERS;
    const floor = Math.floor(raw);
    return { city, raw, floor, frac: raw - floor };
  });
  const allocated = entries.reduce((acc, e) => acc + e.floor, 0);
  const remainder = TOTAL_USERS - allocated;
  // Distribui o resíduo pras cidades com maior frac (Largest Remainder)
  const sortedByFrac = [...entries].sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < remainder; i += 1) {
    sortedByFrac[i].floor += 1;
  }
  return entries.map((e) => ({ city: e.city, count: e.floor }));
}

/* ── Pool de nomes pra display ────────────────────────────
 * Pool fechado de ~60 primeiros nomes brasileiros + ~60
 * sobrenomes. Cada mock user gera "Nome Sobrenome" via index
 * determinístico — não precisa biblioteca externa.
 */
const FIRST_NAMES = [
  'Ana', 'Bruna', 'Camila', 'Daniela', 'Eduarda', 'Fernanda', 'Gabriela', 'Helena',
  'Isabela', 'Júlia', 'Karina', 'Larissa', 'Mariana', 'Natália', 'Olívia', 'Patrícia',
  'Rafaela', 'Sabrina', 'Tatiana', 'Vitória', 'Yasmin',
  'André', 'Bruno', 'Caio', 'Daniel', 'Eduardo', 'Felipe', 'Gabriel', 'Hugo',
  'Igor', 'João', 'Kauã', 'Lucas', 'Mateus', 'Nicolas', 'Otávio', 'Pedro',
  'Rafael', 'Samuel', 'Thiago', 'Vinícius', 'Yuri',
];
const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Ferreira',
  'Rodrigues', 'Almeida', 'Nascimento', 'Carvalho', 'Gomes', 'Martins', 'Araújo',
  'Ribeiro', 'Mendes', 'Barbosa', 'Rocha', 'Dias', 'Cardoso', 'Teixeira',
  'Pinto', 'Moreira', 'Cavalcanti', 'Castro', 'Vieira', 'Andrade', 'Correia',
];
function generateName(rng: () => number): string {
  return `${FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]}`;
}

/* ── Função principal ───────────────────────────────────── */

export interface GeneratorOptions {
  /** Seed pra reproducibility. Default 42 — mude pra ter outra
   *  distribuição. */
  seed?: number;
}

export function generateMockUsers(opts: GeneratorOptions = {}): MockUser[] {
  const rng = makeRng(opts.seed ?? 42);
  const users: MockUser[] = [];
  let uid = 0;

  /* Distribuição proporcional aos monthlyListeners do CSV.
   * Pre-computado pra exatamente 10000 users com Largest Remainder. */
  const quota = computeUsersPerCity();
  for (const { city, count } of quota) {
    for (let i = 0; i < count; i += 1) {
      const dLat = gaussian(rng) * kmToLat(city.sigmaKm);
      const dLng = gaussian(rng) * kmToLng(city.sigmaKm, city.center[1]);
      uid += 1;
      users.push({
        id: `sim-${uid.toString(36)}`,
        lng: city.center[0] + dLng,
        lat: city.center[1] + dLat,
        name: generateName(rng),
        avatarSeed: Math.floor(rng() * 64),
        tier: sampleTier(rng),
        lastActiveSec: sampleLastActive(rng),
        city: city.name,
        region: city.region,
        __simulated: true,
      });
    }
  }

  return users;
}

/* ── Agregação por cidade (pra "cidade bombando") ────────
 * Computado uma vez sobre o dataset gerado. Retorna a contagem
 * total e a contagem de ativos (lastActiveSec < 300) por cidade.
 */
export interface CityStats {
  city: string;
  region: Region;
  total: number;
  active: number;        // lastActiveSec < 300s
  superfans: number;
  center: [number, number];
  /** Desvio padrão geográfico em km (espalhamento real da cidade).
   *  Consumido pelos layers de quota pra dimensionar o spread dos
   *  dots gerados — SP (sigmaKm=14) espalha muito mais que Sorocaba
   *  (sigmaKm=5). Vem do CITY_SEEDS, copiado aqui pra evitar lookup. */
  sigmaKm: number;
  /** Ouvintes mensais do CSV original (peso bruto). Usado pelo
   *  quotaFor() pra escalar densidade visual proporcionalmente nos
   *  ranges externos (continent/state/region). cityPeak/cityMid
   *  ignoram esse valor — todas as cidades preenchem a tela igual
   *  quando focadas. */
  monthlyListeners: number;
}

export function aggregateByCity(users: MockUser[]): CityStats[] {
  const map = new Map<string, CityStats>();
  for (const u of users) {
    const seed = CITY_SEEDS.find((c) => c.name === u.city);
    if (!seed) continue;
    let entry = map.get(u.city);
    if (!entry) {
      entry = {
        city: u.city,
        region: u.region,
        total: 0,
        active: 0,
        superfans: 0,
        center: seed.center,
        sigmaKm: seed.sigmaKm,
        monthlyListeners: seed.monthlyListeners,
      };
      map.set(u.city, entry);
    }
    entry.total += 1;
    if (u.lastActiveSec < 300) entry.active += 1;
    if (u.tier === 'superfan') entry.superfans += 1;
  }
  return Array.from(map.values()).sort((a, b) => b.active - a.active);
}
