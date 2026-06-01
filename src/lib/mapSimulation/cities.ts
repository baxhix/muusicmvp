/* ============================================================
 * MAP SIMULATION — Catálogo de polos urbanos da artista.
 *
 * Per feedback "iremos simular 10k de usuários online, distribuídos
 * proporcionalmente pelas cidades de acordo com o arquivo em anexo"
 * (distribuicao.csv), as 50 cidades aqui vêm do top de ouvintes
 * mensais reais. A coluna `monthlyListeners` é o peso bruto usado
 * pra distribuir o TOTAL_USERS (10k) proporcionalmente.
 *
 * Observação importante: os top-5 (SP, BH, Curitiba, Brasília,
 * Campinas) somam ~5 milhões e dominam massivamente sobre os 45
 * restantes (~12k somados). Distribuição literal proporcional gera:
 *   - SP    ≈ 4106 users  (41% do total)
 *   - BH    ≈ 1648 users
 *   - Curitiba ≈ 1448
 *   - Brasília ≈ 1395
 *   - Campinas ≈ 1378
 *   - RJ    ≈ 1 user      (508 ÷ 5,05M × 10k)
 *   - resto ≈ 0-1 user cada
 *
 * Isso reflete fielmente o desbalanço do dataset original. Tier
 * `tierFor` continua determinando o que aparece visualmente — só
 * top-5 cairão em XL/L; resto em XS (presença simbólica).
 *
 * Cada cidade tem:
 *   - center [lng, lat] real
 *   - monthlyListeners: peso pra distribuição (do CSV)
 *   - sigmaKm: desvio padrão da gaussiana usada pra espalhar os
 *     usuários ao redor do centro
 *   - region: agrupamento geográfico (sudeste/sul/norte/nordeste/
 *     centro-oeste/internacional)
 *   - country: BR / PT / PY / CL
 * ============================================================ */

export type Region =
  | 'sudeste'
  | 'centro-oeste'
  | 'sul'
  | 'norte'
  | 'nordeste'
  | 'internacional';

export type Country =
  | 'BR' | 'PT' | 'PY' | 'CL'
  | 'UK' | 'DE' | 'IT' | 'FR' | 'ES'
  | 'CN' | 'AU' | 'RU' | 'BD' | 'TH'
  | 'CD' | 'SD' | 'IQ' | 'ZA' | 'AF' | 'NG'
  | 'EC' | 'CO' | 'VE' | 'US' | 'IE';

/** Override do pulse da cidade — pra simular "burst de crescimento"
 *  em cidades menores (forçar XL mesmo com poucos ouvintes) e/ou
 *  testar variante de cor (pink/roxo) em locais selecionados. */
export interface PulseOverride {
  tier?: 'xl' | 'l' | 'm' | 's' | 'xs';
  color?: 'pink';
}

export interface CitySeed {
  name: string;
  center: [number, number]; // [lng, lat]
  monthlyListeners: number;  // peso bruto do CSV
  sigmaKm: number;
  region: Region;
  country: Country;
  /** Override opcional do pulse — força tier visual maior (XL/L)
   *  em cidades menores, ou troca cor pra variante pink. */
  pulseOverride?: PulseOverride;
}

export const CITY_SEEDS: CitySeed[] = [
  // ── TOP 5 (mega-polos) ────────────────────────────────────
  { name: 'São Paulo',              center: [-46.6333, -23.5505], monthlyListeners: 2074181, sigmaKm: 14, region: 'sudeste',      country: 'BR' },
  { name: 'Belo Horizonte',         center: [-43.9542, -19.9167], monthlyListeners:  832561, sigmaKm: 11, region: 'sudeste',      country: 'BR' },
  { name: 'Curitiba',               center: [-49.2733, -25.4284], monthlyListeners:  731427, sigmaKm: 11, region: 'sul',          country: 'BR' },
  { name: 'Brasília',               center: [-47.9292, -15.7801], monthlyListeners:  704891, sigmaKm: 11, region: 'centro-oeste', country: 'BR' },
  { name: 'Campinas',               center: [-47.0608, -22.9099], monthlyListeners:  696250, sigmaKm:  9, region: 'sudeste',      country: 'BR' },

  // ── 6-15 ──────────────────────────────────────────────────
  { name: 'Rio de Janeiro',         center: [-43.1729, -22.9068], monthlyListeners:     508, sigmaKm: 12, region: 'sudeste',      country: 'BR' },
  { name: 'Porto Alegre',           center: [-51.2177, -30.0346], monthlyListeners:     464, sigmaKm: 11, region: 'sul',          country: 'BR' },
  { name: 'Fortaleza',              center: [-38.5267,  -3.7172], monthlyListeners:     434, sigmaKm: 10, region: 'nordeste',     country: 'BR' },
  { name: 'Salvador',               center: [-38.5014, -12.9714], monthlyListeners:     410, sigmaKm: 10, region: 'nordeste',     country: 'BR' },
  { name: 'Goiânia',                center: [-49.2532, -16.6864], monthlyListeners:     388, sigmaKm:  9, region: 'centro-oeste', country: 'BR' },
  { name: 'Manaus',                 center: [-60.0217,  -3.1190], monthlyListeners:     372, sigmaKm: 10, region: 'norte',        country: 'BR' },
  { name: 'Florianópolis',          center: [-48.5482, -27.5954], monthlyListeners:     360, sigmaKm:  7, region: 'sul',          country: 'BR', pulseOverride: { tier: 'xl' } },
  { name: 'Recife',                 center: [-34.8770,  -8.0476], monthlyListeners:     350, sigmaKm:  9, region: 'nordeste',     country: 'BR' },
  { name: 'Belém',                  center: [-48.5022,  -1.4554], monthlyListeners:     340, sigmaKm:  9, region: 'norte',        country: 'BR' },
  { name: 'Campo Grande',           center: [-54.6464, -20.4486], monthlyListeners:     331, sigmaKm:  8, region: 'centro-oeste', country: 'BR' },

  // ── 16-30 ─────────────────────────────────────────────────
  { name: 'Joinville',              center: [-48.8489, -26.3044], monthlyListeners:     322, sigmaKm:  6, region: 'sul',          country: 'BR' },
  { name: 'Cuiabá',                 center: [-56.0974, -15.6014], monthlyListeners:     316, sigmaKm:  8, region: 'centro-oeste', country: 'BR', pulseOverride: { tier: 'xl' } },
  { name: 'Lisboa',                 center: [ -9.1393,  38.7223], monthlyListeners:     311, sigmaKm:  7, region: 'internacional', country: 'PT' },
  { name: 'Uberlândia',             center: [-48.2772, -18.9186], monthlyListeners:     306, sigmaKm:  6, region: 'sudeste',      country: 'BR' },
  { name: 'São Luís',               center: [-44.3068,  -2.5391], monthlyListeners:     302, sigmaKm:  7, region: 'nordeste',     country: 'BR' },
  { name: 'Ribeirão Preto',         center: [-47.8103, -21.1775], monthlyListeners:     297, sigmaKm:  5, region: 'sudeste',      country: 'BR' },
  { name: 'Bauru',                  center: [-49.0606, -22.3147], monthlyListeners:     293, sigmaKm:  5, region: 'sudeste',      country: 'BR' },
  { name: 'São José dos Campos',    center: [-45.8841, -23.2237], monthlyListeners:     290, sigmaKm:  5, region: 'sudeste',      country: 'BR' },
  { name: 'Natal',                  center: [-35.2090,  -5.7945], monthlyListeners:     287, sigmaKm:  6, region: 'nordeste',     country: 'BR' },
  { name: 'Maringá',                center: [-51.9382, -23.4205], monthlyListeners:     284, sigmaKm:  5, region: 'sul',          country: 'BR', pulseOverride: { tier: 'xl' } },
  { name: 'Guarulhos',              center: [-46.5333, -23.4628], monthlyListeners:     282, sigmaKm:  5, region: 'sudeste',      country: 'BR' },
  { name: 'Sorocaba',               center: [-47.4585, -23.5015], monthlyListeners:     280, sigmaKm:  5, region: 'sudeste',      country: 'BR' },
  { name: 'João Pessoa',            center: [-34.8631,  -7.1195], monthlyListeners:     278, sigmaKm:  6, region: 'nordeste',     country: 'BR', pulseOverride: { tier: 'xl' } },
  { name: 'Vitória',                center: [-40.3097, -20.3155], monthlyListeners:     275, sigmaKm:  6, region: 'sudeste',      country: 'BR' },
  { name: 'Maceió',                 center: [-35.7350,  -9.6498], monthlyListeners:     273, sigmaKm:  6, region: 'nordeste',     country: 'BR' },

  // ── 31-50 ─────────────────────────────────────────────────
  { name: 'Londrina',               center: [-51.1626, -23.3045], monthlyListeners:     272, sigmaKm:  5, region: 'sul',          country: 'BR' },
  { name: 'Teresina',               center: [-42.8042,  -5.0892], monthlyListeners:     269, sigmaKm:  6, region: 'nordeste',     country: 'BR' },
  { name: 'Santo André',            center: [-46.5383, -23.6633], monthlyListeners:     268, sigmaKm:  4, region: 'sudeste',      country: 'BR' },
  { name: 'Blumenau',               center: [-49.0667, -26.9194], monthlyListeners:     266, sigmaKm:  4, region: 'sul',          country: 'BR' },
  { name: 'Osasco',                 center: [-46.7917, -23.5325], monthlyListeners:     265, sigmaKm:  4, region: 'sudeste',      country: 'BR' },
  { name: 'Serra',                  center: [-40.3072, -20.1216], monthlyListeners:     264, sigmaKm:  4, region: 'sudeste',      country: 'BR' },
  { name: 'Santos',                 center: [-46.3322, -23.9608], monthlyListeners:     263, sigmaKm:  5, region: 'sudeste',      country: 'BR' },
  { name: 'Ponta Grossa',           center: [-50.1626, -25.0950], monthlyListeners:     262, sigmaKm:  5, region: 'sul',          country: 'BR' },
  { name: 'Aracaju',                center: [-37.0731, -10.9472], monthlyListeners:     260, sigmaKm:  6, region: 'nordeste',     country: 'BR' },
  { name: 'Porto',                  center: [ -8.6291,  41.1579], monthlyListeners:     259, sigmaKm:  6, region: 'internacional', country: 'PT' },
  { name: 'Porto Velho',            center: [-63.9039,  -8.7619], monthlyListeners:     258, sigmaKm:  7, region: 'norte',        country: 'BR' },
  { name: 'Palmas',                 center: [-48.3603, -10.2491], monthlyListeners:     257, sigmaKm:  6, region: 'norte',        country: 'BR' },
  { name: 'Niterói',                center: [-43.0939, -22.8833], monthlyListeners:     254, sigmaKm:  5, region: 'sudeste',      country: 'BR' },
  { name: 'Feira de Santana',       center: [-38.9663, -12.2664], monthlyListeners:     253, sigmaKm:  5, region: 'nordeste',     country: 'BR' },
  { name: 'São Bernardo do Campo',  center: [-46.5650, -23.6914], monthlyListeners:     253, sigmaKm:  4, region: 'sudeste',      country: 'BR' },
  { name: 'Caxias do Sul',          center: [-51.1794, -29.1678], monthlyListeners:     252, sigmaKm:  5, region: 'sul',          country: 'BR' },
  { name: 'Asunción',               center: [-57.5759, -25.2637], monthlyListeners:     251, sigmaKm:  9, region: 'internacional', country: 'PY' },
  { name: 'Itajaí',                 center: [-48.6614, -26.9070], monthlyListeners:     249, sigmaKm:  4, region: 'sul',          country: 'BR' },
  { name: 'Santiago',               center: [-70.6483, -33.4569], monthlyListeners:     249, sigmaKm: 10, region: 'internacional', country: 'CL' },
  { name: 'Juiz de Fora',           center: [-43.3503, -21.7642], monthlyListeners:     248, sigmaKm:  5, region: 'sudeste',      country: 'BR' },

  // ── INTERNACIONAIS (mocadas, ~290-320 ouvintes) ──────────
  // Adicionadas pra simular alcance global da artista, com volume
  // próximo ao de Uberlândia (306 ouvintes mensais).
  { name: 'Londres',                center: [ -0.1276,  51.5074], monthlyListeners:     320, sigmaKm: 10, region: 'internacional', country: 'UK' },
  { name: 'Paris',                  center: [  2.3522,  48.8566], monthlyListeners:     312, sigmaKm:  9, region: 'internacional', country: 'FR' },
  { name: 'Bangkok',                center: [100.5018,  13.7563], monthlyListeners:     311, sigmaKm: 11, region: 'internacional', country: 'TH' },
  { name: 'Berlim',                 center: [ 13.4050,  52.5200], monthlyListeners:     308, sigmaKm:  8, region: 'internacional', country: 'DE' },
  { name: 'Shanghai',               center: [121.4737,  31.2304], monthlyListeners:     305, sigmaKm: 12, region: 'internacional', country: 'CN' },
  { name: 'Melbourne',              center: [144.9631, -37.8136], monthlyListeners:     304, sigmaKm:  9, region: 'internacional', country: 'AU' },
  { name: 'Barcelona',              center: [  2.1734,  41.3851], monthlyListeners:     301, sigmaKm:  7, region: 'internacional', country: 'ES' },
  { name: 'Pequim',                 center: [116.4074,  39.9042], monthlyListeners:     296, sigmaKm: 12, region: 'internacional', country: 'CN' },
  { name: 'Roma',                   center: [ 12.4964,  41.9028], monthlyListeners:     295, sigmaKm:  8, region: 'internacional', country: 'IT' },
  { name: 'Moscou',                 center: [ 37.6173,  55.7558], monthlyListeners:     290, sigmaKm: 11, region: 'internacional', country: 'RU' },
  { name: 'Dhaka',                  center: [ 90.4125,  23.8103], monthlyListeners:     287, sigmaKm: 10, region: 'internacional', country: 'BD' },

  // ── INTERNACIONAIS extras (África, Oriente Médio, Latam, US) ──
  // 4 cidades com pulseColor: 'pink' pra testar variante de cor.
  { name: 'Joanesburgo',            center: [ 28.0473, -26.2041], monthlyListeners:     295, sigmaKm: 11, region: 'internacional', country: 'ZA' },
  { name: 'Bogotá',                 center: [-74.0721,   4.7110], monthlyListeners:     285, sigmaKm: 11, region: 'internacional', country: 'CO' },
  { name: 'Boston',                 center: [-71.0589,  42.3601], monthlyListeners:     280, sigmaKm:  8, region: 'internacional', country: 'US' },
  { name: 'Quito',                  center: [-78.4678,  -0.1807], monthlyListeners:     270, sigmaKm:  8, region: 'internacional', country: 'EC' },
  { name: 'Austin',                 center: [-97.7431,  30.2672], monthlyListeners:     270, sigmaKm:  8, region: 'internacional', country: 'US' },
  { name: 'Abuja',                  center: [  7.4951,   9.0765], monthlyListeners:     265, sigmaKm:  8, region: 'internacional', country: 'NG' },
  { name: 'Denver',                 center: [-104.9903, 39.7392], monthlyListeners:     260, sigmaKm:  8, region: 'internacional', country: 'US' },
  { name: 'Sacramento',             center: [-121.4944, 38.5816], monthlyListeners:     255, sigmaKm:  7, region: 'internacional', country: 'US' },
  { name: 'Baghdad',                center: [ 44.3661,  33.3152], monthlyListeners:     245, sigmaKm:  9, region: 'internacional', country: 'IQ', pulseOverride: { color: 'pink' } },
  { name: 'Caracas',                center: [-66.9036,  10.4806], monthlyListeners:     240, sigmaKm:  9, region: 'internacional', country: 'VE' },
  { name: 'Khartoum',               center: [ 32.5599,  15.5007], monthlyListeners:     230, sigmaKm:  9, region: 'internacional', country: 'SD', pulseOverride: { color: 'pink' } },
  { name: 'Kabul',                  center: [ 69.2075,  34.5553], monthlyListeners:     218, sigmaKm:  8, region: 'internacional', country: 'AF', pulseOverride: { color: 'pink' } },
  { name: 'Kisangani',              center: [ 25.1900,   0.5167], monthlyListeners:     215, sigmaKm:  7, region: 'internacional', country: 'CD', pulseOverride: { color: 'pink' } },
  /* Dublin (IE) — adicionado pra cobrir o exemplo do feedback
   * "Sua afinidade musical está em Dublin, na Irlanda". */
  { name: 'Dublin',                 center: [ -6.2603,  53.3498], monthlyListeners:     210, sigmaKm:  7, region: 'internacional', country: 'IE' },
];

/** Total de usuários simulados — per feedback "simular 10k usuários online". */
export const TOTAL_USERS = 10000;

/** Soma dos ouvintes mensais — usada pra normalizar a distribuição
 *  proporcional. Pre-calculada pra evitar recomputo. */
export const SUM_MONTHLY_LISTENERS = CITY_SEEDS.reduce(
  (acc, c) => acc + c.monthlyListeners,
  0,
);

/** REGION_TOTALS mantido pra retrocompatibilidade — agora é derivado
 *  da soma de monthlyListeners por região, escalado pro TOTAL_USERS.
 *  Consumers que ainda dependem disso (legacy) continuam funcionando. */
export const REGION_TOTALS: Record<Region, number> = (() => {
  const byRegion: Record<Region, number> = {
    'sudeste': 0,
    'centro-oeste': 0,
    'sul': 0,
    'norte': 0,
    'nordeste': 0,
    'internacional': 0,
  };
  CITY_SEEDS.forEach((c) => {
    byRegion[c.region] += c.monthlyListeners;
  });
  const totals: Record<Region, number> = {
    'sudeste': 0,
    'centro-oeste': 0,
    'sul': 0,
    'norte': 0,
    'nordeste': 0,
    'internacional': 0,
  };
  (Object.keys(byRegion) as Region[]).forEach((r) => {
    totals[r] = Math.round((byRegion[r] / SUM_MONTHLY_LISTENERS) * TOTAL_USERS);
  });
  return totals;
})();
