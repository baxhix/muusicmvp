/* ============================================================
 * MAP SIMULATION — Catálogo de polos urbanos brasileiros.
 *
 * Cada cidade tem:
 *   - center [lng, lat] real
 *   - weight: proporção de usuários do total da REGIÃO que cai
 *     nesse polo (somatório por região = 1.0)
 *   - sigmaKm: desvio padrão da gaussiana usada pra espalhar os
 *     usuários ao redor do centro. Capitais densas: σ pequeno
 *     (8-12km); cidades médias: 5-8km; sertão/interior: σ maior
 *     (40-80km) pra ralear naturalmente.
 *
 * Distribuição total (per product spec):
 *   Sudeste:      27% → 810 users
 *   Centro-Oeste: 32% → 960 users
 *   Sul:          22% → 660 users
 *   Norte:        19% → 570 users
 * ============================================================ */

export type Region = 'sudeste' | 'centro-oeste' | 'sul' | 'norte';

export interface CitySeed {
  name: string;
  center: [number, number]; // [lng, lat]
  weight: number;            // 0..1 within region
  sigmaKm: number;
  region: Region;
}

export const CITY_SEEDS: CitySeed[] = [
  /* ── SUDESTE (27% — 810 usuários) ───────────────────── */
  { name: 'São Paulo',          center: [-46.6333, -23.5505], weight: 0.43, sigmaKm: 14, region: 'sudeste' },
  { name: 'Rio de Janeiro',     center: [-43.1729, -22.9068], weight: 0.22, sigmaKm: 12, region: 'sudeste' },
  { name: 'Belo Horizonte',     center: [-43.9542, -19.9167], weight: 0.11, sigmaKm: 10, region: 'sudeste' },
  { name: 'Campinas',           center: [-47.0608, -22.9099], weight: 0.06, sigmaKm: 7,  region: 'sudeste' },
  { name: 'Vitória',            center: [-40.3097, -20.3155], weight: 0.04, sigmaKm: 6,  region: 'sudeste' },
  { name: 'Sorocaba',           center: [-47.4585, -23.5015], weight: 0.04, sigmaKm: 5,  region: 'sudeste' },
  { name: 'Santos',             center: [-46.3322, -23.9608], weight: 0.03, sigmaKm: 5,  region: 'sudeste' },
  { name: 'Niterói',            center: [-43.0939, -22.8833], weight: 0.03, sigmaKm: 5,  region: 'sudeste' },
  { name: 'Ribeirão Preto',     center: [-47.8103, -21.1775], weight: 0.02, sigmaKm: 5,  region: 'sudeste' },
  { name: 'Juiz de Fora',       center: [-43.3503, -21.7642], weight: 0.02, sigmaKm: 5,  region: 'sudeste' },

  /* ── CENTRO-OESTE (32% — 960 usuários) ───────────────
   * Distribuição "anormal" vs população real — concentração
   * intencional pra testar densidade na faixa Brasília-Goiás-MS.
   */
  { name: 'Brasília',           center: [-47.9292, -15.7801], weight: 0.40, sigmaKm: 11, region: 'centro-oeste' },
  { name: 'Goiânia',            center: [-49.2532, -16.6864], weight: 0.23, sigmaKm: 9,  region: 'centro-oeste' },
  { name: 'Campo Grande',       center: [-54.6464, -20.4486], weight: 0.13, sigmaKm: 8,  region: 'centro-oeste' },
  { name: 'Cuiabá',             center: [-56.0974, -15.6014], weight: 0.11, sigmaKm: 8,  region: 'centro-oeste' },
  { name: 'Anápolis',           center: [-48.9525, -16.3281], weight: 0.05, sigmaKm: 6,  region: 'centro-oeste' },
  { name: 'Rondonópolis',       center: [-54.6356, -16.4708], weight: 0.03, sigmaKm: 5,  region: 'centro-oeste' },
  { name: 'Várzea Grande',      center: [-56.1322, -15.6486], weight: 0.03, sigmaKm: 5,  region: 'centro-oeste' },
  { name: 'Dourados',           center: [-54.8059, -22.2236], weight: 0.02, sigmaKm: 4,  region: 'centro-oeste' },

  /* ── SUL (22% — 660 usuários) ────────────────────────── */
  { name: 'Porto Alegre',       center: [-51.2177, -30.0346], weight: 0.27, sigmaKm: 11, region: 'sul' },
  { name: 'Curitiba',           center: [-49.2733, -25.4284], weight: 0.26, sigmaKm: 11, region: 'sul' },
  { name: 'Florianópolis',      center: [-48.5482, -27.5954], weight: 0.13, sigmaKm: 8,  region: 'sul' },
  { name: 'Caxias do Sul',      center: [-51.1794, -29.1678], weight: 0.07, sigmaKm: 5,  region: 'sul' },
  { name: 'Londrina',           center: [-51.1626, -23.3045], weight: 0.07, sigmaKm: 5,  region: 'sul' },
  { name: 'Joinville',          center: [-48.8489, -26.3044], weight: 0.07, sigmaKm: 5,  region: 'sul' },
  { name: 'Maringá',            center: [-51.9382, -23.4205], weight: 0.05, sigmaKm: 4,  region: 'sul' },
  { name: 'Pelotas',            center: [-52.3372, -31.7654], weight: 0.04, sigmaKm: 4,  region: 'sul' },
  { name: 'Blumenau',           center: [-49.0667, -26.9194], weight: 0.04, sigmaKm: 4,  region: 'sul' },

  /* ── NORTE (19% — 570 usuários) ──────────────────────
   * Norte é vasto e ralo — σ maiores em algumas pra dar a
   * sensação de "espalhado pela floresta" sem grids artificiais.
   */
  { name: 'Manaus',             center: [-60.0212, -3.1190],  weight: 0.39, sigmaKm: 13, region: 'norte' },
  { name: 'Belém',              center: [-48.5039, -1.4554],  weight: 0.31, sigmaKm: 11, region: 'norte' },
  { name: 'Porto Velho',        center: [-63.9039, -8.7619],  weight: 0.09, sigmaKm: 8,  region: 'norte' },
  { name: 'Macapá',             center: [-51.0664, 0.0356],   weight: 0.07, sigmaKm: 7,  region: 'norte' },
  { name: 'Rio Branco',         center: [-67.8243, -9.9747],  weight: 0.05, sigmaKm: 6,  region: 'norte' },
  { name: 'Boa Vista',          center: [-60.6753, 2.8235],   weight: 0.05, sigmaKm: 7,  region: 'norte' },
  { name: 'Palmas',             center: [-48.3603, -10.2491], weight: 0.04, sigmaKm: 6,  region: 'norte' },
];

/** Totais por região — locked-in per product spec. */
export const REGION_TOTALS: Record<Region, number> = {
  'sudeste':       810,
  'centro-oeste':  960,
  'sul':           660,
  'norte':         570,
};

export const TOTAL_USERS = 3000;
