'use client';

import { memo, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Map as MapboxMap, MapLayerMouseEvent, MapMouseEvent } from 'mapbox-gl';
import { globeStore } from '@/lib/globeStore';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import { useSimulationData } from '@/lib/mapSimulation';
import styles from './SimulationHUD.module.css';
/* Estilos globais dos avatares do reveal (DOM injetado por
 * Mapbox Marker fora da árvore React) — precisa ser CSS plain
 * porque CSS Modules + :global() puro falham no build do Next. */
import './MapSimulation.globals.css';

/**
 * MapSimulationLayer — camada sandbox que renderiza mock users no
 * mapa via Mapbox layers (heatmap + clusters + circles por tier).
 *
 * Não tem JSX visível — só side-effects no map instance.
 * Mounted como qualquer componente React, gated pelo flag de
 * brainstorm `mapSimulation`. Quando flag desliga, cleanup remove
 * todas as sources/layers — zero leak.
 *
 * Bandas de zoom (LOD):
 *   - zoom 3-7   → heatmap dominante; clusters começam a aparecer
 *                  em 5 mas convivem com o cobertor de calor
 *   - zoom 7-8   → cross-fade heatmap → clusters/dots
 *   - zoom 8-11  → clusters + dots por tier
 *   - zoom 11+   → dots por tier, halo em superfãs visíveis
 *
 * Heatmap arquitetura: lê de SOURCE_HEAT (não-clusterizada) pra
 * que cada um dos 7k usuários contribua individualmente pra
 * convolução de densidade. Tentativa anterior usava a source
 * clusterizada — features de cluster têm `sum_weight` mas NÃO
 * `weight`, então a `heatmap-weight: ['get', 'weight']` lia
 * undefined → renderia com peso 0 → "quase invisível no zoom
 * Brasil" (reportado pelo usuário).
 *
 * Otimizações de GPU/bateria (per feedback "celular esquentando"):
 *   - Mobile: dataset subsampleado pra ~2.333 features (i % 3)
 *   - Halo layer desligado no mobile
 *   - Cluster radius maior no mobile (70 vs 50)
 *   - HUD sem backdrop-filter (era major source of GPU thrash)
 *
 * Não há drift de movimento — dataset estático per product spec.
 */

/** Detecta mobile via viewport. Capacidade GPU em iPhones/Androids
 *  intermediários é ~3-5× menor que MacBook M-series — vale a
 *  pena pagar o custo de uma checagem pra cortar layers caros. */
function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/* Duas sources sobre o MESMO dataset:
 *   - SOURCE_ID: clusterizada via Supercluster, alimenta clusters
 *     + dots no zoom alto.
 *   - SOURCE_HEAT: NÃO-clusterizada, alimenta o heatmap. Sem essa
 *     separação, a `heatmap-weight: ['get', 'weight']` lia do
 *     CLUSTER FEATURE (que não tem `weight`, só `sum_weight`) e
 *     a heatmap renderizava com peso 0 — quase invisível no zoom
 *     Brasil. Fix per feedback "quase não tenho a percepção WOW".
 *   Custo: dataset duplica em memória (~1.5MB total pra 7k features),
 *   trade aceitável pelo ganho visual. */
const SOURCE_ID      = 'mapsim-users';
const SOURCE_HEAT    = 'mapsim-users-heat';
const SOURCE_AMBIENT  = 'mapsim-ambient';     // pontos sintéticos pra densidade no zoom out
const SOURCE_MARINGA_24 = 'mapsim-maringa-24'; // 24 pontos mock em Maringá (zoom 8-12)
const SOURCE_QUOTAS  = 'mapsim-quotas';       // pontos visuais por cidade × range de zoom
const LAYER_HEAT     = 'mapsim-heatmap';
const LAYER_AMBIENT  = 'mapsim-ambient-dots'; // dots 1px/2px espalhados (zoom 3-6)
const LAYER_MARINGA_24 = 'mapsim-maringa-24';  // 24 dots em Maringá (zoom 8-12, 4px diameter)
const LAYER_QUOTAS_CONTINENT      = 'mapsim-quotas-continent';      // dots zoom 3.3-5.4 (raio 700km)
const LAYER_QUOTAS_STATE          = 'mapsim-quotas-state';          // dots zoom 5-7  (3px diam)
const LAYER_QUOTAS_REGION         = 'mapsim-quotas-region';         // dots zoom 7-9  (espalha pela pulse)
const LAYER_QUOTAS_CITYMID        = 'mapsim-quotas-city-mid';       // dots zoom 9.5-11 (32 pela cidade real)
const LAYER_QUOTAS_CITYPEAK_GLOW  = 'mapsim-quotas-city-peak-glow'; // halo verde difuso por baixo do peak
const LAYER_QUOTAS_CITYPEAK       = 'mapsim-quotas-city-peak';      // dots zoom 11-12.5 (preenche tela)
const LAYER_CL       = 'mapsim-clusters';     // BLOB orgânico verde (sem borda, blur alto)
const LAYER_CL_T     = 'mapsim-cluster-count'; // texto só no hover
const LAYER_HALO     = 'mapsim-superfan-halo';
const LAYER_SF_PIC   = 'mapsim-superfan-pic';

/* Pontos AMBIENT — distribuição sintética sobre a América do Sul.
 *
 * Per feedback "distribua alguns pontos de 1 e 2 px na área. Esses
 * pontos com o zoom bem afastado podem ser mocados e não
 * necessariamente um ponto atrelado a um usuário."
 *
 * O dataset principal (CITY_SEEDS) concentra os 7k users em ~35
 * polos urbanos. No zoom Brasil isso deixa vácuos visuais entre as
 * cidades (Amazônia, Cerrado, Sertão). Esses pontos sintéticos
 * preenchem esses vácuos com uma "constelação" de presença leve.
 *
 * Geração: grid 14×9 sobre o retângulo [-73°W, -36°W] × [-32°S, +4°N]
 * com perturbação determinística por índices (sem Math.random pra
 * ser reprodutível em SSR / cache). Alguns pontos caem no oceano
 * mas são poucos e ficam discretos com a opacity baixa. */
function generateAmbientPoints(): GeoJSON.Feature[] {
  const W = -73;
  const E = -36;
  const S = -32;
  const N = 4;
  /* Grid 11×7 = 77 pontos (era 14×9 = 126) — per feedback
   * "menos pontos de 2px e 1px espalhados" no zoom out.
   * Visual mais limpo, deixa as cidades reais (DOTFAR/CL)
   * comunicarem onde a presença concentra. */
  const cols = 11;
  const rows = 7;
  const features: GeoJSON.Feature[] = [];
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < rows; j += 1) {
      // Perturbação determinística — não-grid sem PRNG.
      const dx = (((i * 17 + j * 23) % 100) / 100 - 0.5) * 1.6;
      const dy = (((i * 31 + j * 13) % 100) / 100 - 0.5) * 1.4;
      const lng = W + (E - W) * (i / cols) + dx;
      const lat = S + (N - S) * (j / rows) + dy;
      /* Tamanho fixo 1.5 (3px diâmetro) per feedback "em todos os
       * níveis de zoom, não use pontos verdes menores de 3px". Antes
       * alternava 1px/2px (sizes 0.5 e 1.0), o que violava o piso. */
      const size = 1.5;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { size, ambient: true },
      });
    }
  }
  return features;
}

/* ── Pontos sintéticos distribuídos em Maringá ──────────
 *
 * Per feedback: testar transição visual entre dois níveis de
 * zoom com quantidades diferentes de pontos.
 *   - 12 pontos no peak zoom 8.6
 *   - 24 pontos no peak zoom 10.6
 *
 * Maringá center: [-51.9382, -23.4205] (do CITY_SEEDS).
 * Distribuição gaussiana com sigma 5km via mulberry32 inline.
 * `seed` diferente por chamada → 12 e 24 não compartilham
 * posicionamento (variação visual entre os dois "estados"). */
function generateMaringaPoints(count: number, seed: number): GeoJSON.Feature[] {
  const cx = -51.9382;
  const cy = -23.4205;
  const sigmaKm = 5;
  const cosLat = Math.cos((cy * Math.PI) / 180);
  const sigmaLat = sigmaKm / 111;
  const sigmaLng = sigmaKm / (111 * cosLat);

  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const features: GeoJSON.Feature[] = [];
  for (let i = 0; i < count; i += 1) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [cx + gauss() * sigmaLng, cy + gauss() * sigmaLat],
      },
      properties: { mockMaringa: true },
    });
  }
  return features;
}

/* ═══════════════════════════════════════════════════════════════════
 * ★ PADRÃO DE DISTRIBUIÇÃO DE USUÁRIOS POR CIDADE × ZOOM ★
 * ═══════════════════════════════════════════════════════════════════
 *
 * Esse é o FORMATO PADRÃO da feature de simulação visual de usuários:
 * proporcional ao volume real (active count) da cidade, escalonando
 * em 5 faixas de zoom — do continente ao detalhe de cidade.
 *
 * ─── PRINCÍPIOS ───
 * 1. DESACOPLAR "VER" DE "SER"
 *    O dataset de 7k users (SOURCE_HEAT/SOURCE_ID) alimenta heatmap,
 *    clusters e contadores. Mas os DOTS VISUAIS vêm das tabelas
 *    abaixo, NÃO de amostragem fragile do dataset. UX-first.
 *
 * 2. CONTINUIDADE ENTRE FAIXAS (sem saltos)
 *    Todos os ranges da mesma cidade COMPARTILHAM a mesma seed PRNG.
 *    O ponto i é o mesmo gauss em todos os ranges — só o sigma muda.
 *    Cada range superior ADICIONA novos pontos depois dos primeiros
 *    N (que continuam alinhados em angle com o range inferior).
 *    Resultado: conforme zoom in, pontos "se contraem" radialmente
 *    em direção ao centro e novos vão aparecendo ao redor.
 *
 * 3. LAND MASK
 *    Ranges `continent` e `state` (com sigma grande) usam rejection
 *    sampling pra garantir que dots fiquem dentro do território
 *    continental do Brasil (não no oceano).
 *
 * 4. CAP VISUAL, NÃO 1:1 COM REAL
 *    Cidade XL com 3000 ativos NÃO mostra 3000 dots — mostra o cap
 *    do tier (840 no peak). O dataset real continua disponível pra
 *    heatmap/contadores via "X ouvintes" no badge do pulse.
 *
 * ─── ESCALA POR FAIXA DE ZOOM (cidade XL como SP) ───
 *
 *   FAIXA      ZOOM         DOTS (xl)  SIGMA      SHAPE
 *   ─────────  ───────────  ─────────  ─────────  ──────────────────
 *   continent  3.3 – 5.4      30       350 km     halo continental
 *   state      6   – 7        59       150 km     ao redor do pulse
 *   region     7   – 8       143        18 km     área da pulse
 *   cityMid    9   – 10      294       7.7 km     cidade real
 *   cityPeak  11   – 12      840       7.7 km     preenche tela
 *
 * Tamanho do dot: 3px (state/region) → 4px (cityMid/cityPeak).
 * Glow halo verde de 12px difuso entra a partir de z=10.7 só no peak.
 *
 * ─── ESCALA PROPORCIONAL POR CIDADE ───
 *
 * Per feedback "cabem os pontos máximos dentro da tela ... conforme
 * vai diminuindo o zoom, aí sim diminui proporcionalmente":
 *
 *   cityPeak / cityMid:  CAP ESCALONADO POR RANK ordinal (1-10 do
 *     CSV recebe full cap, 11-30 médio, 31-50 reduzido). Otimização
 *     de performance — preenchimento visual quando focado mas sem
 *     pagar 840 × 50 features se a maioria das cidades nunca é
 *     foco do user:
 *       rank  1-10 → cityPeak 840 / cityMid 294
 *       rank 11-30 → cityPeak 300 / cityMid 150
 *       rank 31-50 → cityPeak 100 / cityMid  60
 *     Mobile: subsample 1/2 em ambos pra cortar mais.
 *
 *   region / state / continent:  PROPORCIONAL ao monthlyListeners
 *     da cidade. Sqrt scale pra amortecer desbalanço extremo do
 *     CSV (SP=2M vs RJ=508).
 *
 *     scale = sqrt(ml / 2074181)
 *
 *   Exemplos:
 *     SP   → scale 1.000 → region 143 / state 59 / continent 30
 *     BH   → scale 0.633 → region  91 / state 37 / continent 19
 *     RJ   → scale 0.016 → region   2 / state  1 / continent  1
 *     Niter→ scale 0.011 → region   2 / state  1 / continent  1
 *
 * ─── ONDE AJUSTAR ───
 * Tudo nas TABELAS abaixo (QUOTAS_BY_TIER / SIZE_BY_RANGE /
 * SIGMA_FACTOR_BY_RANGE / RANGE_ZOOMS). NENHUM addLayer / paint /
 * filter precisa ser editado pra mexer em densidade ou faixa.
 * ═══════════════════════════════════════════════════════════════════ */
type CityTier = 'xl' | 'l' | 'm' | 's' | 'xs';
type QuotaRange = 'continent' | 'state' | 'region' | 'cityMid' | 'cityPeak';

/** Tier de cada cidade pela contagem de ativos.
 *
 *  Thresholds calibrados ao dataset real:
 *    - SP    ≈ 488 ativos (43% × 1890 SE × 60% active rate) → XL
 *    - RJ    ≈ 250 ativos → M
 *    - BH    ≈ 125 ativos → S
 *    - Demais → XS
 *
 *  Antes o threshold XL era 700, mas SP nunca atingia (a maior cidade
 *  do dataset bate ~490). Resultado: tier='l' com cityPeak=180,
 *  visualmente esparso quando o usuário esperava densidade alta.
 *  Bumpamos thresholds pra que pelo menos a cidade líder vire XL. */
function tierFor(active: number): CityTier {
  if (active >= 400) return 'xl';
  if (active >= 250) return 'l';
  if (active >= 130) return 'm';
  if (active >= 70)  return 's';
  return 'xs';
}

/** Quotas por tier × range.
 *
 *  cityPeak (zoom ~12) tem cap de "preencher a tela" — per feedback
 *  "se tiver 3000 usuários online, mostram apenas o LIMITE pra
 *  preencher a tela e não os 3.000". Cap por tier porque mesmo
 *  desktop tem teto pra densidade sem virar mancha verde sólida.
 *
 *  cityMid (zoom ~10.6) fixo em 32 por tier "ativo" — per feedback
 *  "mesmo que tenha muitos usuários, distribua 32 espalhados pela
 *  cidade". Tier baixo reduz pra evitar over-populate cidade pequena.
 *
 *  region (zoom ~8.6) e state (zoom ~6) ficam discretos — quem
 *  comunica volume nesses zooms é o pulse + heatmap. Os dots aqui
 *  são "tempero". */
/* Per feedback: progressão escalonada em SP (% do total no z12=840):
 *   z 6-7  →  7% =  59 dots (state)
 *   z 7-8  → 17% = 143 dots (region)
 *   z 9-10 → 35% = 294 dots (cityMid)
 *   z 10-12 → preenche até 100% = 840 dots (cityPeak)
 *
 * Tiers menores escalonados na mesma proporção contra seu cityPeak. */
const QUOTAS_BY_TIER: Record<Exclude<CityTier, 'xs'>, Record<QuotaRange, number>> = {
  xl: { continent: 30, state: 59, region: 143, cityMid: 294, cityPeak: 840 },
  l:  { continent: 20, state: 13, region:  31, cityMid:  63, cityPeak: 180 },
  m:  { continent: 10, state:  7, region:  17, cityMid:  35, cityPeak: 100 },
  s:  { continent:  5, state:  4, region:   9, cityMid:  18, cityPeak:  50 },
};

/** Tamanho do dot (raio em px) por range.
 *  state    = 1.5 → 3px diâmetro (per feedback "no zoom 6 ... com 3px")
 *  region   = 1.25 → 2.5px (intermediário)
 *  cityMid  = 2 → 4px diâmetro (per feedback "Deixe os pontos com 4x4px"
 *             no z 9-11, mesma escala visual do cityPeak)
 *  cityPeak = 2 → 4px diâmetro (per feedback "pontos 4x4px no zoom máximo") */
const SIZE_BY_RANGE: Record<QuotaRange, number> = {
  continent: 1.5,  // 3px diameter (mesmo piso global)
  state:    1.5,   // 3px diameter (piso: nenhum dot abaixo disso)
  region:   2,     // 4px diameter — per feedback "pequenos pontos de
                   //  4px ao redor" pra dar consistência visual com
                   //  cityMid/cityPeak no zoom intermediário (7-8).
  cityMid:  2,     // 4px diameter
  cityPeak: 2,     // 4px diameter
};

/** Fator de multiplicação aplicado ao sigmaKm da cidade pra
 *  decidir o ESPALHAMENTO geográfico dos dots em cada range.
 *
 *  state/region usam factor > city pra "fugir da região da cidade,
 *  é apenas pra dar a sensação de espalhar" (per feedback). Em zoom
 *  baixo a viewport mostra estado/região inteiro — o "halo" do pulse
 *  precisa ser maior que a cidade real.
 *
 *  cityMid/cityPeak usam factor menor pra ficar "espalhado pela
 *  cidade" (geografia real). */
const SIGMA_FACTOR_BY_RANGE: Record<QuotaRange, number> = {
  continent: 25.0,  // raio 350km via piso absoluto no generateCityQuotaPoints
                    // (não é factor × sigmaKm; o piso domina). SP sigmaKm
                    // 14 × 25 = 350 — o factor existe só pra cidades
                    // grandes não ficarem MENORES que o piso.
  state:    8.00,  // espalhamento amplo (era 4.00). 59 dots c/ spacing
                   // 24px @ z5 precisa de área grande — sigma maior
                   // dá espaço pro Poisson-disk acomodar todos.
                   // Piso absoluto 150km via generateCityQuotaPoints.
  region:   1.30,  // espalha pela área do pulse (era 0.90, bumpado pra
                   // acomodar 143 dots sem amontoar no centro)
  cityMid:  1.00,  // espalhamento pela área da "mancha verde" do heatmap
                   // per feedback "No zoom 9.0, distribua mais os pontos
                   // verdes na área de com a 'mancha' verde em todas as
                   // cidades". SP sigmaKm 14×1.0 = 14km → envelope 3σ
                   // ~42km, cobre o halo do pulse XL no z=9. Sigma maior
                   // que cityPeak (0.55) → no crossfade z 10→11.5 os
                   // pontos "se contraem" radialmente em direção à
                   // cidade real (sem desaparecer, só mudam de lugar).
  cityPeak: 0.55,  // perímetro real da cidade — concentra os 840 dots.
};

/** Range zooms — overlap pequeno entre adjacentes pro crossfade.
 *
 *  cityPeak.max = 13 (não 12) é DELIBERADO: Mapbox usa maxzoom como
 *  EXCLUSIVO. O mapa cap em 12 (Globe.tsx), então o usuário nunca
 *  passa daí; setar 13 garante render em z=12 exato. Bug anterior:
 *  `maxzoom: 12` + `map.maxZoom: 12` → dots somem no pinch máximo. */
/* Per feedback (5/jun/2026): faixas redefinidas pra escalonar SP em
 * 7% → 17% → 35% → 100% do z12 conforme o zoom in:
 *   state:    z 6–7  → 59 dots (7%)
 *   region:   z 7–8  → 143 dots (17%)
 *   cityMid:  z 9–10 → 294 dots (35%, 70% da tela)
 *   cityPeak: z 10–12 → preenche até 840 dots (100%, tela toda) */
const RANGE_ZOOMS: Record<QuotaRange, { min: number; peakStart: number; peakEnd: number; max: number }> = {
  continent: { min: 2.5,  peakStart: 2.5,  peakEnd: 5.4,  max: 5.8  },
  state:    { min: 5.5,  peakStart: 6,    peakEnd: 7,    max: 7.5  },
  region:   { min: 7,    peakStart: 7.3,  peakEnd: 8,    max: 9    },
  cityMid:  { min: 8.5,  peakStart: 9,    peakEnd: 10,   max: 11   },
  /* cityPeak: fade-in longo de z 10 até 11.5, peak em 11.5–12.5
   * (per feedback "Do zoom 10 até 12 vai preenchendo com o total").
   * No z 10-11.5 cityMid sai (sigma 21km → spread amplo) e cityPeak
   * entra (sigma 7.7km → concentrado), criando a sensação de
   * "preencher a tela" gradual. */
  cityPeak: { min: 10,   peakStart: 11.5, peakEnd: 12.5, max: 13   },
};

/** Maior monthlyListeners do dataset (SP). Usado como referência
 *  pra escala proporcional dos ranges externos. Hardcoded pra não
 *  depender de import circular — atualizar se o top mudar. */
const MAX_MONTHLY_LISTENERS = 2074181;

/** Quota efetiva pra (city, range).
 *
 *  Per feedback "vamos simular dados reais dessas cidades MENOS que
 *  cabem os pontos máximos dentro da tela, e conforme vai diminuindo
 *  o zoom, aí sim diminui proporcionalmente":
 *
 *  - cityPeak (z 11-12) e cityMid (z 9-10): CAP FIXO igual pra
 *    TODAS as cidades — quando o user zoma numa cidade, ela
 *    "preenche a tela" independente do tamanho real. SP, BH, RJ,
 *    Niterói — todas mostram 840 dots no peak quando focadas.
 *
 *  - region/state/continent: PROPORCIONAL ao monthlyListeners da
 *    cidade. Usa sqrt scale pra amortecer o desbalanço extremo do
 *    dataset (SP=2M vs RJ=508 → linear seria 0.025% → invisível).
 *    sqrt(508/2.07M) = 0.0157 vs sqrt(1) = 1.0 → ainda dominante
 *    mas RJ não some completamente. */
function quotaFor(
  monthlyListeners: number,
  range: QuotaRange,
  rank: number,  // 1-based rank por monthlyListeners (1 = SP)
): number {
  /* Caps cityPeak/cityMid escalonados por rank — per feedback de
   * otimização "em produção real a atualização desses dados pode
   * ocorrer de forma espaçada". Como não precisamos de 840 dots em
   * todas as 50 cidades simultaneamente:
   *   rank 1-10  → 840 (preenchimento total na tela quando focado)
   *   rank 11-30 → 300 (denso mas sem custar 840 × 20 features)
   *   rank 31-50 → 100 (presença adequada, cauda longa)
   * Reduz total cityPeak de 42k → ~16.4k features (-61%). */
  if (range === 'cityPeak') {
    if (rank <= 10) return 840;
    if (rank <= 30) return 300;
    return 100;
  }
  if (range === 'cityMid') {
    if (rank <= 10) return 294;
    if (rank <= 30) return 150;
    return 60;
  }

  // Demais ranges: proporcional ao tamanho da cidade (sqrt scale)
  const scale = Math.sqrt(
    Math.max(0, monthlyListeners) / MAX_MONTHLY_LISTENERS,
  );
  const baseQuota: Record<'continent' | 'state' | 'region', number> = {
    region:    143,
    state:      59,
    continent:  30,
  };
  /* Piso de 5 dots por cidade per feedback "pequenos pontos de 4px
   * ao redor para não ficar um único ponto isolado". */
  const MIN_DOTS_PER_CITY = 5;
  return Math.max(MIN_DOTS_PER_CITY, Math.round(baseQuota[range] * scale));
}

/** Land mask aproximada do Brasil continental.
 *  Per feedback "No zoom 6, coloque os pontos dentro do continente
 *  e não no oceano".
 *
 *  Estratégia: bounding box ampla + curva da costa leste/sul como
 *  piecewise-linear interp (lng_max em função da lat). Pontos a
 *  leste da curva caem no Atlântico — rejeitados.
 *
 *  Calibração visual com a costa real (não cartograficamente
 *  exata, mas suficiente pra esconder dots no mar). */
function isOnBrazilLand(lng: number, lat: number): boolean {
  // Bounding box do território continental
  if (lat > 5.5 || lat < -34) return false;
  if (lng < -73.5 || lng > -33) return false;

  // Costa leste/sul — pontos-chave (lat, lng_max) do norte ao sul.
  // lng_max define o ponto mais a leste que ainda é terra naquela lat.
  const coast: Array<[number, number]> = [
    [  5,   -50  ], // Cabo Orange (AP)
    [  0,   -49  ], // boca do Amazonas
    [ -3,   -41  ], // Maranhão NE
    [ -5,   -35.5], // Natal (RN)
    [-10,   -34.5], // Recife/Maceió
    [-13,   -38.5], // Salvador
    [-20,   -39.5], // Vitória
    [-23.5, -42  ], // Cabo Frio (RJ)
    [-25,   -47.5], // Paranaguá (PR)
    [-29,   -49.5], // Tramandaí (RS)
    [-34,   -52  ], // Chuí (RS)
  ];

  let lngMax = -33;
  for (let i = 0; i < coast.length - 1; i += 1) {
    const [lat1, lng1] = coast[i];
    const [lat2, lng2] = coast[i + 1];
    if (lat <= lat1 && lat >= lat2) {
      const t = (lat1 - lat) / (lat1 - lat2);
      lngMax = lng1 + (lng2 - lng1) * t;
      break;
    }
  }
  return lng <= lngMax;
}

/** Hash string → uint32 (FNV-1a leve), pra derivar seed determinística
 *  por (cityName + range) sem dependência externa. */
function strHash(s: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Gera N pontos com gaussiana ao redor de city.center pra um range.
 *  Reutiliza a mesma técnica do generateMaringaPoints (Box-Muller +
 *  mulberry32 inline). Determinístico — mesma seed = mesmas posições. */
function generateCityQuotaPoints(
  city: { city: string; center: [number, number]; sigmaKm: number },
  range: QuotaRange,
  count: number,
): GeoJSON.Feature[] {
  if (count <= 0) return [];
  const [cx, cy] = city.center;
  /* Sigma = sigmaKm REAL da cidade × factor por range (tabela
   * SIGMA_FACTOR_BY_RANGE no topo). Ranges externos têm factor > 1
   * pra "fugir da região da cidade" (per feedback), ranges internos
   * (cityMid/cityPeak) ficam dentro do perímetro real.
   *
   * `state` tem piso absoluto de 80km: cidades pequenas (sigmaKm 4-7)
   * × factor 4 dariam só 16-28km, ainda concentrado no centro. 80km
   * garante espalhamento regional pra que o pós-processamento Poisson
   * consiga manter spacing 24px @ z5. */
  const factor = SIGMA_FACTOR_BY_RANGE[range];
  /* Pisos absolutos por range:
   *   - continent: 350km per feedback "Diminua para 350 e irei avaliar"
   *     (antes era 700km — espalhamento exagerado)
   *   - state: 150km (envelope 3σ ≈ 184px @ z5, halo do pulse XL)
   *   - outros: 2km (factor × sigmaKm da cidade já é adequado) */
  const minSigmaKm =
    range === 'continent' ? 350 :
    range === 'state'     ? 150 :
    2;
  const sigmaKm = Math.max(minSigmaKm, city.sigmaKm * factor);
  const cosLat = Math.cos((cy * Math.PI) / 180);
  const sigmaLat = sigmaKm / 111;
  const sigmaLng = sigmaKm / (111 * Math.max(cosLat, 0.05));
  const size = SIZE_BY_RANGE[range];

  /* Seed: TODOS os ranges da mesma cidade COMPARTILHAM a mesma
   * sequência PRNG (per feedback "Não utilize pontos aleatórios no
   * mapa ... conforme o zoom acontece, a experiência é que os pontos
   * apenas mudam de lugar ou se expandem").
   *
   * Como cada range avança o gauss() o mesmo número de vezes pra
   * seus N primeiros pontos, o ponto i é o MESMO gauss em TODOS os
   * ranges — só o sigma muda. Sequência de sigmas no peak (em SP,
   * sigmaKm=14):
   *   continent 700km → state 150km → region 18km → cityMid 7.7km → cityPeak 7.7km
   * Resultado: durante crossfade entre layers, ponto i "se aproxima"
   * radialmente do centro da cidade conforme zoom in (sigma decresce).
   * Sem "salto" — só contração suave + adição de novos pontos. */
  const seedKey = `${city.city}`;
  let s = strHash(seedKey) >>> 0;
  const rnd = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const features: GeoJSON.Feature[] = [];
  const MAX_TRIES_PER_DOT = 30;
  /* Rejection sampling pra ranges `continent` e `state`: pontos podem
   * cair no oceano (sigma 700km / 150km a partir de cidades costeiras).
   * Per feedback "do continente pra dentro" e "No zoom 6, coloque os
   * pontos dentro do continente". Outros ranges (region/cityMid/peak)
   * têm sigma menor, geralmente dentro do perímetro real da cidade,
   * então rejection é desnecessária. */
  const needsLandMask = range === 'continent' || range === 'state';
  for (let i = 0; i < count; i += 1) {
    let gX = 0;
    let gY = 0;
    let lng = cx;
    let lat = cy;
    let tries = 0;
    do {
      gX = gauss();
      gY = gauss();
      lng = cx + gX * sigmaLng;
      lat = cy + gY * sigmaLat;
      tries += 1;
      if (!needsLandMask) break;
    } while (!isOnBrazilLand(lng, lat) && tries < MAX_TRIES_PER_DOT);

    /* Pro range `state` armazenamos gX/gY/cityLng/cityLat nas
     * properties — habilita o recompute dinâmico das coords baseado
     * no zoom (efeito "se aproximando da cidade" conforme zoom in,
     * via map.on('zoom', ...) que aplica setData com sigma decrescente).
     * Os outros ranges ficam estáticos (sigma proporcional já é
     * adequado em todos os zooms da faixa). */
    const props: GeoJSON.GeoJsonProperties =
      range === 'state'
        ? {
            range,
            size,
            city: city.city,
            gX,
            gY,
            cityLng: cx,
            cityLat: cy,
            baseSigmaKm: sigmaKm,
          }
        : { range, size, city: city.city };

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: props,
    });
  }
  return features;
}

/** Sigma efetivo (km) do range `state` em função do zoom — usado pelo
 *  recompute on zoom pra criar a "animação de aproximação".
 *
 *  z 5  → 250km (espalhado pelo continente, halo amplo do pulse)
 *  z 6  → 170km (cobre região do pulse XL)
 *  z 7  → 90km  (perto da cidade, antes do region tomar conta)
 *
 *  Linear interp entre os keypoints. Fora do range [5, 7] usa o
 *  valor da extremidade (clamp). */
function sigmaKmForStateAtZoom(zoom: number): number {
  if (zoom <= 5) return 250;
  if (zoom >= 7) return 90;
  if (zoom <= 6) return 250 + (170 - 250) * (zoom - 5); // 5→250, 6→170
  return 170 + (90 - 170) * (zoom - 6);                  // 6→170, 7→90
}

/** Recalcula as coordinates de features `range==='state'` baseado no
 *  sigma efetivo no zoom atual. Mutação in-place — o caller chama
 *  setData() pro source refletir. Features sem gX/gY (outros ranges)
 *  são ignoradas. */
function recomputeStateCoords(features: GeoJSON.Feature[], zoom: number): void {
  const sigmaKm = sigmaKmForStateAtZoom(zoom);
  for (const f of features) {
    const p = f.properties as Record<string, unknown> | null;
    if (!p || p.range !== 'state') continue;
    const cityLng = p.cityLng as number;
    const cityLat = p.cityLat as number;
    const gX = p.gX as number;
    const gY = p.gY as number;
    const cosLat = Math.cos((cityLat * Math.PI) / 180);
    const dLat = sigmaKm / 111;
    const dLng = sigmaKm / (111 * Math.max(cosLat, 0.05));
    (f.geometry as GeoJSON.Point).coordinates = [
      cityLng + gX * dLng,
      cityLat + gY * dLat,
    ];
  }
}

/** Distância em pixels entre dois pontos geográficos no zoom dado.
 *  Usa projeção Web Mercator (mesma do Mapbox), retorna pixels Euclidean.
 *  O(1) por par. Usado pelo filtro Poisson-disk abaixo. */
function geoPxDistance(
  lng1: number, lat1: number,
  lng2: number, lat2: number,
  zoom: number,
): number {
  const scale = (1 << zoom) * 256;
  const x1 = ((lng1 + 180) / 360) * scale;
  const x2 = ((lng2 + 180) / 360) * scale;
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const mercY = (rad: number) =>
    (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  const y1 = mercY(radLat1) * scale;
  const y2 = mercY(radLat2) * scale;
  return Math.hypot(x1 - x2, y1 - y2);
}

/** Poisson-disk thinning: percorre features na ordem dada e mantém só
 *  as que estão a pelo menos `minPx` pixels (medidos no `refZoom`) de
 *  todas as já aceitas. Greedy O(N²) — aceitável pra N≤200. Os pontos
 *  primeiros (cidades mais ativas, pela ordem do iterator) têm
 *  prioridade. */
function thinByMinPxDist(
  features: GeoJSON.Feature[],
  minPx: number,
  refZoom: number,
): GeoJSON.Feature[] {
  const accepted: GeoJSON.Feature[] = [];
  for (const f of features) {
    if (f.geometry.type !== 'Point') continue;
    const [lng, lat] = f.geometry.coordinates as [number, number];
    let tooClose = false;
    for (const a of accepted) {
      const [alng, alat] = (a.geometry as GeoJSON.Point).coordinates as [number, number];
      if (geoPxDistance(lng, lat, alng, alat, refZoom) < minPx) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) accepted.push(f);
  }
  return accepted;
}

/** Gera TODAS as features de quota (todas as cidades × todos os ranges)
 *  numa única FeatureCollection. Os layers depois filtram por
 *  `properties.range`.
 *
 *  Pós-processamento: features do range `state` passam por Poisson-disk
 *  filter com spacing mínimo 24px @ zoom 5 (per feedback "Mantenha uma
 *  distância mínima de 24px entre eles" no zoom 5-7). Conforme o zoom
 *  in pra 7, os pontos ficam ainda mais distantes em pixels — então
 *  ancorar no zoom 5 garante o piso pra toda a faixa do range state.
 *  Os outros ranges (region/cityMid/cityPeak) NÃO são thinados — só
 *  o state, per feedback "não precisam respeitar a distância mínima a
 *  partir do zoom 7". */
function generateAllQuotaPoints(
  cities: Array<{
    city: string;
    active: number;
    center: [number, number];
    sigmaKm: number;
    monthlyListeners: number;
  }>,
  opts: { mobile?: boolean } = {},
): GeoJSON.Feature[] {
  const stateRaw: GeoJSON.Feature[] = [];
  const others:   GeoJSON.Feature[] = [];
  const ranges: QuotaRange[] = ['continent', 'state', 'region', 'cityMid', 'cityPeak'];
  cities.forEach((c, idx) => {
    const rank = idx + 1;  // 1-based — assume cities sorted desc por ml
    for (const r of ranges) {
      let n = quotaFor(c.monthlyListeners, r, rank);
      /* Mobile subsample 1/2 nos ranges densos (cityMid/cityPeak).
       * Per feedback "em produção real a atualização desses dados
       * pode ocorrer de forma espaçada" — UI mock, perda de
       * densidade aceitável pra ganho de frame budget no mobile. */
      if (opts.mobile && (r === 'cityMid' || r === 'cityPeak')) {
        n = Math.max(5, Math.round(n / 2));
      }
      if (n <= 0) continue;
      const features = generateCityQuotaPoints(c, r, n);
      if (r === 'state') stateRaw.push(...features);
      else               others.push(...features);
    }
  });
  /* Poisson-disk thinning REMOVIDO per feedback "Remova totalmente
   * a regra dos 24px de distanciamento". O thinning estava
   * descartando ~80% dos dots de SP no state porque o spacing 24px
   * @ z5 era agressivo demais pro sigma — resultado: SP em z6
   * mostrava apenas a onda pulsante.
   *
   * Sem o thinning, os 59 dots de SP entram todos no source. O
   * espalhamento natural pela gaussiana (sigma 150km) já evita
   * sobreposição perceptível em z 5-7. As funções `geoPxDistance`
   * e `thinByMinPxDist` ficam declaradas mas não são chamadas —
   * preservadas pro caso de precisarmos voltar. */
  return [...stateRaw, ...others];
}

/* Pool de avatares Pravatar (i.pravatar.cc) — 12 fotos de pessoas
 * reais, IDs escolhidos pra diversidade visual. Pré-carregados como
 * Mapbox images no map.load, depois referenciados via
 * `icon-image: ['concat', 'avatar-', ['%', ['get', 'avatarSeed'], 12]]`.
 * O mock user já carrega `avatarSeed` 0-63 — fazemos modulo 12 pra
 * mapear no pool. Determinístico (mesma seed → mesma foto sempre).
 *
 * Por que Pravatar e não asset local: 12 binários adicionais no repo
 * pra um feature de simulação sandbox = ruído. CDN externo simplifica;
 * se cair, o dot verde por baixo continua sendo o fallback. */
const PRAVATAR_IDS = [1, 5, 11, 13, 17, 23, 29, 33, 41, 47, 53, 61];

/* DOT_COLOR_EXPR e TIER_RADIUS_EXPR foram removidos com a
 * eliminação dos layers LAYER_DOT/LAYER_DOTGLOW. A coloração e
 * o tamanho dos dots quota agora vêm direto das tabelas
 * SIZE_BY_RANGE / QUOTAS_BY_TIER lá no topo. */

interface UserHoverInfo {
  kind: 'user';
  id: string;
  name: string;
  city: string;
  tier: 'superfan' | 'top100' | 'top1000' | 'fan';
  online: boolean;
  lastActiveSec: number;
  /** Posição em screen pixels onde renderizar o card. */
  clientX: number;
  clientY: number;
}

interface ClusterHoverInfo {
  kind: 'cluster';
  count: number;
  clientX: number;
  clientY: number;
}

type HoverInfo = UserHoverInfo | ClusterHoverInfo;

export default function MapSimulationLayer() {
  const { flags } = useBrainstormFlags();
  const enabled = flags.mapSimulation;
  const data = useSimulationData();
  const [hover, setHover] = useState<HoverInfo | null>(null);
  /* Timer de auto-dismiss do hover card no mobile — desktop usa
   * mouseleave que zera o state na hora. */
  const dismissTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let unsubscribe: (() => void) | null = null;
    let currentMap: MapboxMap | null = null;

    const cleanup = () => {
      if (!currentMap) return;
      try {
        for (const id of [
          LAYER_SF_PIC, LAYER_HALO,
          LAYER_QUOTAS_CITYPEAK, LAYER_QUOTAS_CITYPEAK_GLOW, LAYER_QUOTAS_CITYMID, LAYER_QUOTAS_REGION, LAYER_QUOTAS_STATE, LAYER_QUOTAS_CONTINENT,
          LAYER_CL_T, LAYER_CL,
          LAYER_MARINGA_24,
          LAYER_AMBIENT, LAYER_HEAT,
        ]) {
          if (currentMap.getLayer(id)) currentMap.removeLayer(id);
        }
        if (currentMap.getSource(SOURCE_QUOTAS)) currentMap.removeSource(SOURCE_QUOTAS);
        if (currentMap.getSource(SOURCE_MARINGA_24)) currentMap.removeSource(SOURCE_MARINGA_24);
        if (currentMap.getSource(SOURCE_AMBIENT)) currentMap.removeSource(SOURCE_AMBIENT);
        if (currentMap.getSource(SOURCE_HEAT)) currentMap.removeSource(SOURCE_HEAT);
        if (currentMap.getSource(SOURCE_ID)) currentMap.removeSource(SOURCE_ID);
        /* Avatares ficam carregados no map mesmo após o flag
         * desligar — map.removeImage é caro em iOS e o conjunto
         * é pequeno (12 imgs). Próximo enable reaproveita o cache. */
      } catch {
        /* mapa pode estar sendo destruído — ignorar */
      }
      currentMap = null;
    };

    const mobile = isMobileViewport();

    const attach = (mapUnknown: unknown | null) => {
      // Mapa desmontou — limpa
      if (!mapUnknown) {
        cleanup();
        return;
      }
      const map = mapUnknown as MapboxMap;
      currentMap = map;

      /* Dataset subsamplado pra GPU móvel — sample determinística.
       * Quick win de performance: 1/3 → 1/4 (≈2.333 → 1.750 features).
       * Reduz ~25% das features e mantém densidade visual com os
       * layers de heatmap/clusters dilatados. Cobertura geográfica
       * preservada — cada cidade ainda contribui 1/4 dos seus users. */
      const sourceData = mobile
        ? {
            ...data.geojson,
            features: data.geojson.features.filter((_, i) => i % 4 === 0),
          }
        : data.geojson;

      // Source NÃO-clusterizada — exclusiva pro heatmap. Cada
      // feature individual entra na convolução de densidade do
      // Mapbox, gerando o "cobertor" contínuo que pinta o Brasil
      // todo. Se reaproveitássemos a source clusterizada abaixo,
      // o heatmap leria features de CLUSTER (cujo `weight` é
      // undefined; só `sum_weight` existe) → renderia com peso 0
      // → quase invisível. Esse era o bug visual reportado.
      if (!map.getSource(SOURCE_HEAT)) {
        map.addSource(SOURCE_HEAT, {
          type: 'geojson',
          data: sourceData as GeoJSON.FeatureCollection,
        });
      }

      // Source AMBIENT — pontos sintéticos pra densidade no zoom out.
      // Per feedback "esses pontos com o zoom bem afastado podem ser
      // mocados". Gera ~126 features uma vez (determinístico) e injeta
      // como GeoJSON estático.
      if (!map.getSource(SOURCE_AMBIENT)) {
        map.addSource(SOURCE_AMBIENT, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: generateAmbientPoints(),
          } as GeoJSON.FeatureCollection,
        });
      }

      /* SOURCE_MARINGA_24 + LAYER_MARINGA_24 REMOVIDOS per feedback
       * "Remova os pontos que parecem fixos no mapa próximo à Curitiba,
       * Ponta Grossa, Guarapuava, União da Vitória, Cascavel, Maringá,
       * Londrina e Ciudad del Este".
       *
       * Esse mock de 24 dots em Maringá era debug temporário pra validar
       * a transição visual entre layers — já cumpriu seu papel. Quando
       * o user enquadrava essa região do PR, os 24 dots fixos em Maringá
       * destoavam dos pontos aleatórios das quotas. As cidades vizinhas
       * (Curitiba/Cascavel/Ponta Grossa etc) também ficavam no viewport
       * e o user percebia como "pontos fixos espalhados pela região".
       *
       * As quotas (continent/state/region/cityMid/cityPeak) — ligadas
       * ao teste de volume de usuários — ficam preservadas. */

      // Source clusterizada — Mapbox Supercluster nativo. Alimenta
      // clusters numerados e dots individuais (LOD por zoom).
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: sourceData as GeoJSON.FeatureCollection,
          cluster: true,
          /* Cluster radius maior no mobile = menos clusters
           * simultâneos no viewport = menos symbol/text layers
           * pintando por frame. */
          clusterRadius: mobile ? 70 : 50,
          clusterMaxZoom: 10,
          clusterProperties: {
            sum_weight: ['+', ['get', 'weight']],
            superfans:  ['+', ['case', ['==', ['get', 'tier'], 'superfan'], 1, 0]],
          },
        });
      }

      // 1) HEATMAP — o "cobertor" de presença que vende o WOW.
      //
      //    Bombamos vs iteração anterior porque o usuário reportou
      //    "quase não tenho percepção WOW da quantidade de online".
      //    A causa raiz era o source clusterizado (corrigido acima);
      //    aqui amplificamos params pra que, com os pontos certos
      //    chegando à heatmap, o Brasil fique visualmente vivo:
      //      - Intensity +60% no peak (1.4 vs 0.9 antes)
      //      - Radius +30% (28 vs 22) — borrões maiores, conectando
      //        cidades vizinhas num lençol contínuo
      //      - Opacity peak 0.95 (era 0.9) — mais punch
      //      - maxzoom 8 (era 7) — heatmap persiste enquanto rola
      //        para o zoom dos clusters, suavizando a transição
      //      - online amplifica: features online (lastActiveSec<300)
      //        recebem peso 2.5× via expressão case — o "vivo"
      //        domina o gradiente, não a contagem total.
      if (!map.getLayer(LAYER_HEAT)) {
        map.addLayer({
          id: LAYER_HEAT,
          type: 'heatmap',
          source: SOURCE_HEAT,
          maxzoom: 12,
          paint: {
            /* Peso 2.5× pra online — eles dominam o gradiente
             * e dão a sensação de "presença AGORA" em vez de
             * "histórico de uso". */
            'heatmap-weight': [
              'case',
              ['==', ['get', 'online'], 1], 2.5,
              1,
            ],
            'heatmap-intensity': [
              'interpolate', ['linear'], ['zoom'],
              3, 0.16,   // ainda mais suave per "formas ainda evidentes"
              5, 0.22,
              6, 0.28,
              7, 0.38,
              9, 0.42,
              11, 0.30,
              12, 0.16,
            ],
            /* Paleta com cauda BEM longa de transparência —
             * iteração após feedback "formas ainda estão evidentes".
             *
             * O segredo da bordas dissolvendo está na cauda inicial:
             * de density 0 até 0.30 a cor é praticamente transparente.
             * Só a partir de 0.55 o verde começa a ter substância.
             * Resultado: as bordas dos blobs ficam invisíveis pro
             * olho humano e só o "core" interno (onde a densidade
             * acumula features) ganha alguma cor. */
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0,    'rgba(0, 0, 0, 0)',
              0.05, 'rgba(20, 83, 45, 0.03)',      // praticamente invisível
              0.30, 'rgba(34, 139, 75, 0.14)',     // verde levíssimo
              0.60, 'rgba(61, 219, 116, 0.30)',    // verde marca
              0.85, 'rgba(120, 220, 140, 0.42)',
              1,    'rgba(150, 230, 160, 0.50)',   // peak ainda suave
            ],
            /* Raio bem maior no zoom out — features se fundem em
             * um wash contínuo sem core definido. Combinado com a
             * cauda longa de transparency na paleta e intensity
             * reduzida, o heatmap pinta uma "aura verde difusa"
             * sobre o Brasil sem círculos discretos. */
            'heatmap-radius': [
              'interpolate', ['linear'], ['zoom'],
              3, 42,     // antes 28
              5, 60,     // antes 42
              6, 58,     // antes 42
              7, 50,
              9, 48,
              11, 55,
              12, 32,
            ],
            /* Heatmap REMOVIDO no zoom out (3-6) per feedback
             * "remova a camada em verde nesse nível de zoom".
             * Entra suavemente a partir do zoom 7 (cidade) onde
             * a presença em manchas faz sentido como contexto. */
            'heatmap-opacity': [
              'interpolate', ['linear'], ['zoom'],
              3,   0,
              5,   0,
              6,   0.05,
              7,   0.22,
              9,   0.28,
              11,  0.20,
              12,  0,
            ],
          },
        });
      }

      // 1b) AMBIENT DOTS — pontinhos sintéticos espalhados pela
      //     América do Sul, ativos só no zoom out (3-6).
      //
      //     Per feedback "distribua alguns pontos de 1 e 2 px na
      //     área. Esses pontos com o zoom bem afastado podem ser
      //     mocados". Os 7k users mock estão concentrados em 35
      //     polos — entre eles fica vácuo. Esses ~126 pontos
      //     adicionais (grid 14×9 com perturbação determinística)
      //     enchem os vácuos sem virar massa, dando a sensação de
      //     "presença em todo lugar".
      //
      //     Alterna entre raio 0.5 (1px) e raio 1 (2px) por paridade
      //     de índice — mistura de tamanhos cria textura visual
      //     natural. Fade-out no zoom 6+ pra ceder lugar pros dots
      //     reais do dataset.
      /* LAYER_AMBIENT REMOVIDO per feedback "Remova os pontos que não
       * fazem parte do experimento de 7.000 usuários". Esses 77 dots
       * eram sintéticos em grid uniforme pelo Brasil (gerados via
       * generateAmbientPoints), sem vínculo com cidade real. O range
       * `continent` (z 3.3-5.4, raio 700km) agora cobre a função de
       * "vida no zoom afastado", mas concentrado em torno dos núcleos
       * de cidades reais.
       *
       * SOURCE_AMBIENT ainda é criado acima — preservamos pra evitar
       * efeito colateral se algum outro consumer precisar. Sem o
       * layer renderizando, o source fica idle. */

      // LAYER_MARINGA_24 REMOVIDO (mock de debug temporário que já
      // cumpriu seu papel — veja comentário no addSource acima).

      // 2) DOTS-FAR — pontinhos 2px verdes visíveis em todo zoom
      //    onde existe heatmap/blob (zoom 3-11).
      //
      //    Per feedback original ("mesmo com o zoom out, distribua
      //    pontos de 2px verdes no mapa para dar a sensação de
      //    grandeza") + feedback novo ("Nesse tipo de visualização
      //    já podem aparecer pontos de 2px distribuídos pelo perímetro
      //    com 'mancha', mantendo a mancha, mas com pontos também").
      //
      //    Antes o maxzoom era 8 → na faixa de zoom 8-10 (que mostra
      //    blobs verdes em cidades) os pontos sumiam e a mancha
      //    ficava "vazia". Agora estende até zoom 11, fade-out
      //    suave em 11-12 (cede lugar pros dots individuais por
      //    tier que dominam no zoom alto).
      //
      //    Usamos SOURCE_HEAT (não-clusterizada) com filtro 1/16 via
      //    `avatarSeed % 16 === 0` — ~437 dots espalhados pelo Brasil.
      //    Filtro online=1 + tier!=superfan (superfãs aparecem como
      //    mini avatar real no zoom alto).
      /* ── SOURCE_QUOTAS + 3 layers de dots por range de zoom ──
       *
       * Refatoração arquitetural: substituímos LAYER_DOTSPARSE +
       * LAYER_DOTFAR + LAYER_DOTFAR2 (que sampleavam features reais
       * via `avatarSeed % N`) por quotas determinísticas controladas
       * pelas tabelas QUOTAS_BY_TIER / SIZE_BY_RANGE / RANGE_ZOOMS no
       * topo do arquivo.
       *
       * Source: GeoJSON estático gerado 1× a partir de data.cities.
       * Cada feature carrega `properties.range` ('state'|'region'|'city')
       * + `properties.size` (raio em px). Os 3 layers filtram por range
       * + têm zoom/opacity próprios pra crossfade entre faixas. */
      /* Animação on-zoom REMOVIDA per feedback "Remova a animação".
       * Os dots do state agora ficam estáticos — coords pre-calculadas
       * uma vez no generateCityQuotaPoints com sigma fixo (piso 150km).
       * As funções sigmaKmForStateAtZoom / recomputeStateCoords ficam
       * declaradas mas inertes (preservadas pra reuso futuro). */
      const quotaFeatures = generateAllQuotaPoints(data.cities, { mobile });

      if (!map.getSource(SOURCE_QUOTAS)) {
        map.addSource(SOURCE_QUOTAS, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: quotaFeatures,
          } as GeoJSON.FeatureCollection,
        });
      }

      const quotaLayerPaint = (
        range: QuotaRange,
      ): mapboxgl.CirclePaint => {
        const z = RANGE_ZOOMS[range];
        return {
          'circle-color': '#3DDB74',
          'circle-stroke-width': 0,
          'circle-radius': ['get', 'size'] as unknown as number,
          'circle-opacity': [
            'interpolate', ['linear'], ['zoom'],
            z.min,        0,
            z.peakStart,  0.95,
            z.peakEnd,    0.95,
            z.max,        0,
          ],
        };
      };

      if (!map.getLayer(LAYER_QUOTAS_CONTINENT)) {
        map.addLayer({
          id: LAYER_QUOTAS_CONTINENT,
          type: 'circle',
          source: SOURCE_QUOTAS,
          minzoom: RANGE_ZOOMS.continent.min,
          maxzoom: RANGE_ZOOMS.continent.max,
          filter: ['==', ['get', 'range'], 'continent'],
          paint: quotaLayerPaint('continent'),
        });
      }
      if (!map.getLayer(LAYER_QUOTAS_STATE)) {
        map.addLayer({
          id: LAYER_QUOTAS_STATE,
          type: 'circle',
          source: SOURCE_QUOTAS,
          minzoom: RANGE_ZOOMS.state.min,
          maxzoom: RANGE_ZOOMS.state.max,
          filter: ['==', ['get', 'range'], 'state'],
          paint: quotaLayerPaint('state'),
        });
      }
      if (!map.getLayer(LAYER_QUOTAS_REGION)) {
        map.addLayer({
          id: LAYER_QUOTAS_REGION,
          type: 'circle',
          source: SOURCE_QUOTAS,
          minzoom: RANGE_ZOOMS.region.min,
          maxzoom: RANGE_ZOOMS.region.max,
          filter: ['==', ['get', 'range'], 'region'],
          paint: quotaLayerPaint('region'),
        });
      }
      if (!map.getLayer(LAYER_QUOTAS_CITYMID)) {
        map.addLayer({
          id: LAYER_QUOTAS_CITYMID,
          type: 'circle',
          source: SOURCE_QUOTAS,
          minzoom: RANGE_ZOOMS.cityMid.min,
          maxzoom: RANGE_ZOOMS.cityMid.max,
          filter: ['==', ['get', 'range'], 'cityMid'],
          paint: quotaLayerPaint('cityMid'),
        });
      }
      /* GLOW layer (halo verde difuso) por BAIXO do cityPeak.
       * Per feedback "com a leve sombra verde ao redor". Mesma source
       * + filter, mas com raio maior, blur alto e opacity baixa —
       * cria a sensação de "sombra" verde envolvendo cada dot sem
       * sacrificar a nitidez do core 4x4px.
       *
       * SKIP NO MOBILE: blur 1.0 sobre 8k+ features (cityPeak já
       * subsamplado) é o layer mais caro do app — mobile médio
       * cai pra ~40fps. Per feedback de otimização, removemos
       * no mobile sem perder a funcionalidade. */
      if (!mobile && !map.getLayer(LAYER_QUOTAS_CITYPEAK_GLOW)) {
        map.addLayer({
          id: LAYER_QUOTAS_CITYPEAK_GLOW,
          /* Per feedback "No zoom 10.1 ao 10.7 remova a mancha verde
           * ao redor dos pontos. Como existe uma transição, o blur
           * fica com uma visão desagradável".
           *
           * Causa: o glow tem circle-blur 1.0 + radius 6 (12px) × 840
           * dots. Mesmo com opacity baixa (0.02-0.10 em z 10.1-10.7),
           * a soma alpha das 840 instâncias borradas vira uma mancha
           * verde difusa em toda a área de SP durante a transição
           * cityMid → cityPeak.
           *
           * Fix: minzoom 10.7 + opacity 0 até 10.7. O glow só entra
           * quando o cityMid já está bem fading out (sigma 21km → 7.7km
           * em curso) e os dots cityPeak começam a ser visualmente
           * dominantes — aí o glow soma sem virar "mancha". */
          type: 'circle',
          source: SOURCE_QUOTAS,
          minzoom: 10.7,
          maxzoom: RANGE_ZOOMS.cityPeak.max,
          filter: ['==', ['get', 'range'], 'cityPeak'],
          paint: {
            'circle-color': '#3DDB74',
            'circle-radius': 6,         // 12px diameter — 3x o core
            'circle-stroke-width': 0,
            'circle-blur': 1.0,         // borrado total → vira halo
            'circle-opacity': [
              'interpolate', ['linear'], ['zoom'],
              10.7,                           0,
              RANGE_ZOOMS.cityPeak.peakStart, 0.22,
              RANGE_ZOOMS.cityPeak.peakEnd,   0.22,
              RANGE_ZOOMS.cityPeak.max,       0,
            ],
          },
        });
      }
      if (!map.getLayer(LAYER_QUOTAS_CITYPEAK)) {
        map.addLayer({
          id: LAYER_QUOTAS_CITYPEAK,
          type: 'circle',
          source: SOURCE_QUOTAS,
          minzoom: RANGE_ZOOMS.cityPeak.min,
          maxzoom: RANGE_ZOOMS.cityPeak.max,
          filter: ['==', ['get', 'range'], 'cityPeak'],
          paint: quotaLayerPaint('cityPeak'),
        });
      }

      // 3) CLUSTERS — BLOB orgânico verde (não mais círculo numerado).
      //
      //    Per feedback "mude o círculo azul, com o número dentro
      //    por uma camada verde, sem borda, com o centro mais denso
      //    e perdendo força nas bordas, de forma inorgânica". Em
      //    Mapbox isso é alcançado com:
      //      - cor verde única (sem step por point_count)
      //      - SEM stroke (`circle-stroke-width: 0`)
      //      - `circle-blur: 1.0` → o círculo fica difuso, sem borda
      //        nítida, com centro mais denso e desbotando organicamente
      //      - tamanho ainda escalado por point_count, mas maior pra
      //        parecer "mancha de presença", não disco
      /* LAYER_CL (blob orgânico verde sobre clusters de users reais)
       * REMOVIDO per feedback "Pontos verdes maiores associados aos
       * usuários reais — remova esses pontos maiores do mapa".
       * O SOURCE_ID continua existindo (alimenta LAYER_CL_T, LAYER_HALO,
       * LAYER_SF_PIC), mas o circle layer que pintava as machas verdes
       * dos clusters não renderiza mais. Heatmap + pulses + quotas
       * continuam comunicando a presença visual.
       *
       * Hover de cluster (mousemove em LAYER_CL) preservado nas linhas
       * abaixo, mas como o layer não existe os handlers viram no-op
       * silencioso — sem error porque Mapbox map.on aceita layer ids
       * que ainda vão ser adicionados ou que não existem. */

      // 4) CLUSTER COUNT — texto SÓ aparece no hover.
      //
      //    Per feedback "Remova os círculos com a quantidade, mostre
      //    essa informação apenas se passar o mouse por cima". O layer
      //    existe (pra estar pronto se precisarmos) mas com opacity 0
      //    permanente. O número real aparece via React overlay
      //    (ClusterHoverCard) ancorado no cursor — mais legível e
      //    independente da escala do mapa.
      if (!map.getLayer(LAYER_CL_T)) {
        map.addLayer({
          id: LAYER_CL_T,
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          minzoom: 5,
          layout: {
            'text-field': ['number-format', ['get', 'point_count'], {}],
            'text-size': 12,
            'text-font': ['Inter Semibold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
          },
          paint: {
            'text-color': '#ffffff',
            'text-opacity': 0,    // sempre invisível — número vai via React overlay
          },
        });
      }

      // LAYER_DOT, LAYER_DOTGLOW removidos — substituídos pelas
      // 3 layers LAYER_QUOTAS_* acima. A diferenciação por tier
      // não é mais visual (todos os dots são verdes puros do mesmo
      // tamanho dentro de cada range). Superfãs continuam ganhando
      // mini avatar de foto real via LAYER_SF_PIC e halo verde via
      // LAYER_HALO — ambos preservados abaixo.

      // 5) HALO em superfãs ONLINE — anel verde em volta. SÓ desktop;
      //    mobile pula esse layer pra economizar GPU (alpha-blended
      //    circle render é caro com muitos superfãs no viewport).
      //    Halo agora é VERDE (não mais amber) pra alinhar com a
      //    paleta "tudo online é verde".
      /* LAYER_HALO (anel verde 14px ao redor de cada superfã online)
       * REMOVIDO per feedback "Pontos verdes maiores associados aos
       * usuários reais — remova esses pontos maiores do mapa". O
       * superfã continua com mini avatar (LAYER_SF_PIC) sem o anel
       * verde envolvente. */

      // 6) MINI AVATAR de SUPERFÃS ONLINE — foto real (Pravatar).
      //
      //    Per feedback "Superfã online simule sempre com um mini
      //    avatar de foto real". Carregamos 12 fotos no map.images
      //    cache (idempotente — addImage só roda se ainda não existe)
      //    e a expressão `icon-image` mapeia cada superfã pra um
      //    slot via `avatarSeed % 12` — determinístico (mesmo user
      //    sempre aparece com a mesma cara).
      //
      //    A imagem aparece SOBRE o dot verde + halo, que continuam
      //    como fallback caso a foto não carregue (CORS, offline,
      //    Pravatar caindo).
      const preloadAvatars = () => {
        PRAVATAR_IDS.forEach((picId, idx) => {
          const imgId = `mapsim-avatar-${idx}`;
          if (map.hasImage(imgId)) return;
          map.loadImage(
            `https://i.pravatar.cc/80?img=${picId}`,
            (err, image) => {
              if (err || !image) return;
              if (!map.hasImage(imgId)) {
                try {
                  map.addImage(imgId, image as HTMLImageElement | ImageBitmap);
                } catch {
                  /* race: outra chamada pode ter adicionado já */
                }
              }
            },
          );
        });
      };
      preloadAvatars();

      if (!map.getLayer(LAYER_SF_PIC)) {
        map.addLayer({
          id: LAYER_SF_PIC,
          type: 'symbol',
          source: SOURCE_ID,
          filter: [
            'all',
            ['!', ['has', 'point_count']],
            ['==', ['get', 'tier'], 'superfan'],
            ['==', ['get', 'online'], 1],
          ],
          minzoom: 8,
          layout: {
            'icon-image': [
              'concat',
              'mapsim-avatar-',
              ['to-string', ['%', ['get', 'avatarSeed'], PRAVATAR_IDS.length]],
            ],
            /* icon-size: Pravatar retorna 80×80. No mapa queremos
             * ~22px no zoom 10 e ~32px no zoom 14. icon-size 0.4
             * = 32px, 0.275 = 22px. Interpolamos. */
            'icon-size': [
              'interpolate', ['linear'], ['zoom'],
              8,  0.22,
              10, 0.30,
              14, 0.42,
            ],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {
            'icon-opacity': [
              'interpolate', ['linear'], ['zoom'],
              8,   0,
              8.5, 1,
            ],
          },
        });
      }

      /* ── Hover/click handlers ─────────────────────────────
       * LAYER_CL: mousemove sobre blob → seta hover info (cluster
       *           com point_count).
       * Hover de USER individual foi removido junto com o LAYER_DOT
       * (dots agora são quotas determinísticas sem identidade real).
       * Mobile usa click + auto-dismiss 3s; click no map vazio limpa.
       */
      const onClusterHover = (e: MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return;
        const f = e.features[0];
        const p = f.properties ?? {};
        const count = Number(p.point_count ?? 0);
        if (!count) return;
        if (dismissTimerRef.current) {
          window.clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = null;
        }
        setHover({
          kind: 'cluster',
          count,
          clientX: e.originalEvent.clientX,
          clientY: e.originalEvent.clientY,
        });
        map.getCanvas().style.cursor = 'pointer';
      };

      const onPointerOut = () => {
        setHover(null);
        map.getCanvas().style.cursor = '';
      };

      const onClusterClick = (e: MapLayerMouseEvent) => {
        onClusterHover(e);
        if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = window.setTimeout(() => {
          setHover(null);
          map.getCanvas().style.cursor = '';
          dismissTimerRef.current = null;
        }, 3000);
        (e as unknown as { _dotHandled?: boolean })._dotHandled = true;
      };

      const onMapClick = (e: MapMouseEvent) => {
        if ((e as unknown as { _dotHandled?: boolean })._dotHandled) return;
        setHover(null);
        if (dismissTimerRef.current) {
          window.clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = null;
        }
      };

      /* rAF-throttle wrapper: agrupa rajadas de mousemove em
       * 1 chamada por frame (~16ms / 60Hz cap). */
      const rafThrottle = <T extends (e: MapLayerMouseEvent) => void>(fn: T): T => {
        let scheduled = false;
        let lastEvent: MapLayerMouseEvent | null = null;
        return ((e: MapLayerMouseEvent) => {
          lastEvent = e;
          if (scheduled) return;
          scheduled = true;
          requestAnimationFrame(() => {
            scheduled = false;
            if (lastEvent) {
              fn(lastEvent);
              lastEvent = null;
            }
          });
        }) as T;
      };
      const onClusterHoverT = rafThrottle(onClusterHover);

      map.on('mousemove', LAYER_CL, onClusterHoverT);
      map.on('mouseleave', LAYER_CL, onPointerOut);
      map.on('click', LAYER_CL, onClusterClick);
      map.on('click', onMapClick);

      /* ── REAL PEOPLE REVEAL LOOP ──────────────────────────
       * Per feedback: "De forma aleatória, a cada 3s surgem, a partir
       * de um ponto verde, 3 avatares, não ao mesmo tempo, com 1 ou
       * 2s de diferença, permanecem por 3s e somem. Para mostrar para
       * o usuário que os pontos são pessoas reais e que estão ali
       * para se conectarem."
       *
       * Mecânica:
       *   - Loop dispara em ciclos de ~5s.
       *   - Cada ciclo: pega 3 features online + não-superfan dentro
       *     do viewport atual, e spawna um Mapbox Marker (DOM) com
       *     foto da Pravatar + primeiro nome em pílula.
       *   - Stagger interno: 1.0-2.2s entre spawns dentro do ciclo.
       *   - Lifetime: 3s visível + 400ms de fade-out → remove do DOM.
       *
       * Gates:
       *   - Zoom < 10 → loop pula esse ciclo (zoom Brasil/região
       *     não tem detalhe suficiente pra um avatar de 38px fazer
       *     sentido visual).
       *   - Nenhuma feature no viewport → pula.
       *   - Superfãs excluídos (eles já têm avatar permanente via
       *     LAYER_SF_PIC).
       *
       * Por que Mapbox Marker (DOM) em vez de symbol layer dinâmico?
       *   - Marker reposiciona AUTOMATICAMENTE durante pan/zoom — o
       *     avatar "gruda" no ponto verde correspondente sem que a
       *     gente precise calcular project()/unproject() em cada
       *     frame de mexida.
       *   - CSS livre pra animação de borbulhar (scale + translateY
       *     com cubic-bezier de bounce). Symbol layer não consegue
       *     fazer fade orgânico com bounce.
       */
      const revealTimers: number[] = [];
      const activeMarkers: mapboxgl.Marker[] = [];

      /* REVEAL_MIN_ZOOM removido per feedback "Os avatares que surgem
       * simulando enviar mensagem devem aparecer em qualquer tipo de
       * zoom". Antes era 10, gating a feature pra zoom de cidade só. */
      /* BATCH 2 + MAX 3 per feedback "Reduza pela metade a
       * quantidade de miniaturas dos usuário que vão aparecendo
       * na tela" (eram 3 e 6 respectivamente). */
      const REVEAL_BATCH_SIZE      = 2;
      const REVEAL_CYCLE_MS        = 5000;
      const REVEAL_STAGGER_MIN_MS  = 1000;
      const REVEAL_STAGGER_MAX_MS  = 2200;
      const REVEAL_LIFETIME_MS     = 10000;  // per feedback "aumente para 10s"
      const REVEAL_EXIT_MS         = 500;    // saída também mais suave (era 400)
      const REVEAL_MAX_ACTIVE      = 3;
      /* Mensagens mock pro balão "direct" que sai do avatar.
       * Per feedback: "Simule uma caixa de mensagem ... saindo
       * de um avatar com uma mensagem/direct que o usuário
       * enviou". Pool curto de mensagens típicas de fan-chat;
       * o índice é determinístico por avatarSeed pra não trocar
       * a mensagem entre re-renders do mesmo usuário. */
      const MOCK_DIRECTS = [
        'Oi, tudo bem?',
        'viu o show ontem?',
        'que demais o álbum 🔥',
        'me passa o setlist?',
        'ana é tudo!!!',
        'fui no fanmeet ontem',
        'qm tá ouvindo aí?',
        'curtiu a nova faixa?',
      ] as const;
      /* Margem de segurança pra evitar que o avatar nasça grudado
       * na borda da tela. O ponto pode estar tecnicamente dentro
       * do bounds geográfico mas o avatar (38px alto + nome + box
       * de reaction de 112px) ficaria cortado. Padding em PIXELS
       * é mais previsível que graus (que variam com latitude). */
      const REVEAL_VIEWPORT_PADDING_PX = 80;
      const REACTION_EMOJIS = ['❤️', '👋', '💬', '👀'] as const;

      /* Detecta capacidade de hover (desktop com mouse, não touch).
       * Per feedback "para aparecer os emojis, no desktop, basta o
       * hover". Em touch devices o hover é simulado depois do tap
       * e geralmente confunde — então só ativamos em devices com
       * mouse real. */
      const supportsHover =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(hover: hover)').matches;

      /* Candidatos: online + não-superfan. Superfã já tem avatar
       * permanente; o efeito é pra "revelar" que os pontinhos
       * anônimos também são pessoas. */
      type FeatureProps = {
        id?: string;
        name?: string;
        tier?: string;
        online?: number;
        avatarSeed?: number;
      };
      const candidates = (data.geojson.features as GeoJSON.Feature[]).filter((f) => {
        const p = (f.properties ?? {}) as FeatureProps;
        return (
          p.online === 1 &&
          p.tier !== 'superfan' &&
          f.geometry?.type === 'Point'
        );
      });

      const spawnReveal = (feature: GeoJSON.Feature) => {
        if (feature.geometry.type !== 'Point') return;
        /* Cap rígido: se já temos 6 ativos, esse spawn é descartado.
         * O ciclo continua, então o próximo batch tem chance. */
        if (activeMarkers.length >= REVEAL_MAX_ACTIVE) return;

        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
        const p = (feature.properties ?? {}) as FeatureProps;
        const picIdx = ((p.avatarSeed ?? 0) % PRAVATAR_IDS.length + PRAVATAR_IDS.length) % PRAVATAR_IDS.length;
        const picId = PRAVATAR_IDS[picIdx];
        const firstName = String(p.name ?? '').split(' ')[0] || 'Fã';

        /* DOM:
         *   <div .mapsim-reveal>
         *     <div .mapsim-reveal-photo-wrap>
         *       <button .mapsim-reveal-photo />   ← clicável
         *       <div   .mapsim-reveal-actions>    ← reaction box, hidden
         *         <button .mapsim-reveal-react>❤️</button>
         *         <button .mapsim-reveal-react>👋</button>
         *         <button .mapsim-reveal-react>💬</button>
         *         <button .mapsim-reveal-react>👀</button>
         *       </div>
         *     </div>
         *     <div .mapsim-reveal-name>{firstName}</div>
         *   </div>
         */
        const el = document.createElement('div');
        el.className = 'mapsim-reveal';

        /* ── BALÃO DE DIRECT MOCK (acima do avatar) ─────────────
         * Per feedback original "Simule uma caixa de mensagem,
         * preta, totalmente arredondada, responsiva ... saindo
         * de um avatar com uma mensagem/direct". Iteração atual:
         *   - Intercala: aparece em ~50% dos avatares (não em
         *     todos). Decisão via `avatarSeed % 2` pra ser
         *     determinístico — mesmo user → mesmo comportamento.
         *   - Texto fixo "Mandou para você" (era "escreveu:").
         *   - Tamanho um pouco maior (CSS).
         *
         * Click dispara `app:mock-direct-open` (consumidor abre
         * o chat detail). Quando o avatar sai sem o usuário ter
         * clicado, dispara `app:mock-direct-unread` pro contador
         * de não lidas. */
        const seedNum = p.avatarSeed ?? 0;
        const showMsg = (seedNum % 2) === 0;
        const msgIdx =
          (((seedNum + picIdx) % MOCK_DIRECTS.length) + MOCK_DIRECTS.length) %
          MOCK_DIRECTS.length;
        const directText = MOCK_DIRECTS[msgIdx];

        // Flag pra distinguir "clicado/lido" vs "expirou sem ler"
        // na hora do cleanup do marker.
        let msgClicked = false;
        let msg: HTMLButtonElement | null = null;

        if (showMsg) {
          msg = document.createElement('button');
          msg.type = 'button';
          msg.className = 'mapsim-reveal-msg';
          msg.setAttribute('aria-label', `Abrir conversa com ${firstName}: ${directText}`);

          const msgPrefix = document.createElement('span');
          msgPrefix.className = 'mapsim-reveal-msg-prefix';
          msgPrefix.textContent = 'Mandou para você';
          msg.appendChild(msgPrefix);

          const msgTextEl = document.createElement('span');
          msgTextEl.className = 'mapsim-reveal-msg-text';
          msgTextEl.textContent = directText;
          msg.appendChild(msgTextEl);

          el.appendChild(msg);

          const msgEl = msg;
          msg.addEventListener('click', (ev) => {
            ev.stopPropagation();
            msgClicked = true;
            try {
              window.dispatchEvent(
                new CustomEvent('app:mock-direct-open', {
                  detail: {
                    name:    firstName,
                    picId,
                    text:    directText,
                    sourceId: (p as FeatureProps).id,
                  },
                }),
              );
            } catch { /* SSR / detached — ignorar */ }
            // Some o balão (já "lido"). Photo + nome continuam
            // até o lifecycle natural do avatar.
            msgEl.style.opacity = '0';
            msgEl.style.transform = 'scale(0.92) translateY(-2px)';
            msgEl.style.pointerEvents = 'none';
          });
        }

        const photoWrap = document.createElement('div');
        photoWrap.className = 'mapsim-reveal-photo-wrap';
        el.appendChild(photoWrap);

        const photo = document.createElement('button');
        photo.type = 'button';
        photo.className = 'mapsim-reveal-photo';
        photo.style.backgroundImage = `url('https://i.pravatar.cc/80?img=${picId}')`;
        photo.setAttribute('aria-label', `Reagir para ${firstName}`);
        photoWrap.appendChild(photo);

        const actions = document.createElement('div');
        actions.className = 'mapsim-reveal-actions';
        REACTION_EMOJIS.forEach((emoji) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'mapsim-reveal-react';
          btn.textContent = emoji;
          /* aria-label muda pro 💬 ("Mandar mensagem") já que esse
           * botão tem comportamento diferente dos outros — abre chat
           * em vez de disparar cascata de reaction. */
          btn.setAttribute(
            'aria-label',
            emoji === '💬'
              ? `Mandar mensagem para ${firstName}`
              : `Enviar ${emoji} para ${firstName}`,
          );
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (emoji === '💬') {
              /* 💬 abre o detalhe do chat com o usuário (per feedback
               * "faça com que eu consiga enviar uma mensagem pra eles
               * clicando no ícone de chat"). Dispatch o mesmo evento
               * que o balão de direct usa — consumer pode abrir o
               * LiveChatPanel pré-fillado com o destinatário. */
              try {
                window.dispatchEvent(
                  new CustomEvent('app:mock-direct-open', {
                    detail: {
                      name:     firstName,
                      picId,
                      text:     '',  // sem mensagem pre-fill — user vai redigir
                      sourceId: (p as FeatureProps).id,
                    },
                  }),
                );
              } catch { /* SSR / detached — ignorar */ }
            } else {
              /* Outros emojis (❤️ 👋 👀) → cascata mocada via
               * HeartsCascade (SimulationHUD escuta esse evento). */
              try {
                window.dispatchEvent(
                  new CustomEvent('app:hearts-cascade', { detail: { text: emoji } }),
                );
              } catch { /* SSR / detached — ignorar */ }
            }
            /* Após qualquer reaction, fecha o box e reagenda a saída
             * pra 1.5s (tempo curto pro usuário ver o efeito completar
             * antes do avatar sumir). */
            el.classList.remove('mapsim-reveal-open');
            scheduleExit(1500);
          });
          actions.appendChild(btn);
        });
        photoWrap.appendChild(actions);

        const name = document.createElement('div');
        name.className = 'mapsim-reveal-name';
        name.textContent = firstName;
        el.appendChild(name);

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom', offset: [0, -8] })
          .setLngLat([lng, lat])
          .addTo(map);
        activeMarkers.push(marker);

        /* ── Lifecycle de saída controlado por handles dinâmicas ──
         * Per feedback "Quando eu clicar no usuário e o box de
         * reações aparecer, o tempo para ele desaparecer deve ser
         * desconsiderado". Antes os timeouts eram fire-and-forget
         * (setTimeout direto no scope do spawn) → impossível
         * cancelar. Agora guardamos as handles em `exitT` e
         * `removeT` e oferecemos `cancelExit()` / `scheduleExit()`
         * pra suspender e re-agendar conforme o usuário interage.
         */
        let exitT: number | null = null;
        let removeT: number | null = null;

        const cancelExit = () => {
          if (exitT !== null) {
            window.clearTimeout(exitT);
            exitT = null;
          }
          if (removeT !== null) {
            window.clearTimeout(removeT);
            removeT = null;
          }
        };

        const scheduleExit = (lifetimeMs: number = REVEAL_LIFETIME_MS) => {
          cancelExit();
          exitT = window.setTimeout(() => {
            el.classList.remove('mapsim-reveal-in');
            el.classList.remove('mapsim-reveal-open');
            el.classList.add('mapsim-reveal-out');
            exitT = null;
          }, lifetimeMs);
          removeT = window.setTimeout(() => {
            try { marker.remove(); } catch { /* já removido */ }
            const idx = activeMarkers.indexOf(marker);
            if (idx >= 0) activeMarkers.splice(idx, 1);
            removeT = null;
            /* Se o balão expirou sem ser clicado, ele "vira
             * mensagem não lida" — dispatch pro contador mockar
             * o badge de unread. Só se o balão chegou a aparecer
             * (showMsg true) — avatares sem balão não geram
             * unread fantasma. */
            if (showMsg && !msgClicked) {
              try {
                window.dispatchEvent(
                  new CustomEvent('app:mock-direct-unread', {
                    detail: {
                      name:     firstName,
                      picId,
                      text:     directText,
                      sourceId: (p as FeatureProps).id,
                    },
                  }),
                );
              } catch { /* ignore */ }
            }
          }, lifetimeMs + REVEAL_EXIT_MS);
          revealTimers.push(exitT, removeT);
        };

        /* Helpers únicos pra abrir/fechar o reaction box —
         * unificam o comportamento de click (mobile) e hover
         * (desktop). Ambos cancelam/reagendam o exit pra que o
         * usuário possa interagir sem perder o avatar. */
        const computeSide = () => {
          const rect = photo.getBoundingClientRect();
          const spaceRight = window.innerWidth - rect.right;
          if (spaceRight < 80) {
            actions.classList.add('mapsim-reveal-actions-left');
          } else {
            actions.classList.remove('mapsim-reveal-actions-left');
          }
        };
        const openBox = () => {
          computeSide();
          cancelExit();
          /* Estabilização visual per feedback "ao passar o mouse pelo
           * avatar ele deve parar de se movimentar". Se o avatar estava
           * em fade-out quando o user veio interagir, revertemos pra
           * fade-in pra ele não ficar semi-transparente / fugindo. */
          el.classList.remove('mapsim-reveal-out');
          el.classList.add('mapsim-reveal-in');
          el.classList.add('mapsim-reveal-open');
        };
        const closeBox = (lifetimeMs: number = 1500) => {
          el.classList.remove('mapsim-reveal-open');
          scheduleExit(lifetimeMs);
        };

        /* Click no photo abre/fecha o reaction box (mobile +
         * fallback desktop). stopPropagation impede que o
         * map.on('click') zere o hover acima. */
        photo.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (el.classList.contains('mapsim-reveal-open')) {
            closeBox();
          } else {
            openBox();
          }
        });

        /* Touch START em mobile cancela exit IMEDIATAMENTE — sem
         * esperar o click se completar (que pode levar 300ms). Per
         * feedback "ao passar o mouse pelo avatar ele deve parar de
         * se movimentar ... tanto desktop quanto mobile". Em touch
         * devices, o equivalente a "passar o mouse" é encostar o
         * dedo. passive: true pra não bloquear o gesture do mapa
         * (pan/pinch continuam funcionando). */
        photoWrap.addEventListener('touchstart', () => {
          cancelExit();
          el.classList.remove('mapsim-reveal-out');
          if (!el.classList.contains('mapsim-reveal-in')) {
            el.classList.add('mapsim-reveal-in');
          }
        }, { passive: true });

        /* Hover-to-open NO DESKTOP. Per feedback "para aparecer
         * os emojis, no desktop, basta o hover". Em touch devices
         * o hover é simulado depois do tap e atrapalha — então
         * só anexamos esses listeners se `(hover: hover)` matches.
         *
         * Eventos no `photoWrap` (que contém photo + reaction box)
         * pra que ao mover o mouse DA foto PRO emoji o mouseleave
         * não dispare (o destino ainda está dentro do wrap).
         *
         * Adicionalmente, anexamos enter/leave no próprio `actions`:
         * quando o mouse entra na paleta, cancelamos qualquer timer
         * de fechamento em curso. Combinado com o pseudo-bridge no
         * CSS e o delay de 200ms abaixo, o usuário tem tempo
         * folgado pra atravessar do avatar até os emojis. */
        if (supportsHover) {
          const HOVER_CLOSE_DELAY = 200;
          let hoverCloseTimer: number | null = null;

          const cancelHoverClose = () => {
            if (hoverCloseTimer !== null) {
              window.clearTimeout(hoverCloseTimer);
              hoverCloseTimer = null;
            }
          };
          const scheduleHoverClose = () => {
            cancelHoverClose();
            hoverCloseTimer = window.setTimeout(() => {
              hoverCloseTimer = null;
              if (el.classList.contains('mapsim-reveal-open')) {
                closeBox();
              }
            }, HOVER_CLOSE_DELAY);
          };

          photoWrap.addEventListener('mouseenter', () => {
            cancelHoverClose();
            openBox();
          });
          photoWrap.addEventListener('mouseleave', () => {
            scheduleHoverClose();
          });
          actions.addEventListener('mouseenter', () => {
            cancelHoverClose();
          });
          actions.addEventListener('mouseleave', () => {
            scheduleHoverClose();
          });
        }

        /* Trigger animação de entrada no próximo frame (CSS transition
         * só funciona se houver mudança de estado APÓS o elemento estar
         * no DOM com o estado inicial). */
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.classList.add('mapsim-reveal-in');
          });
        });

        // Agenda o primeiro lifecycle de saída com o lifetime padrão.
        scheduleExit();
      };

      const tick = () => {
        try {
          /* Gate de zoom removido — avatares spawn em qualquer
           * zoom (per feedback). A filtragem por viewport-in-pixels
           * abaixo já garante que só nascem dentro da área visível. */
          /* Filtra candidatos pela viewport em PIXELS com padding
           * de 80px nas bordas. Antes usávamos só `bounds.contains`
           * geográfico — funcionava, mas avatares podiam nascer
           * grudados na borda da tela (com nome + reaction box
           * cortados). Per feedback "mostre os usuários dentro do
           * ponto de visão do usuário", agora projetamos cada
           * candidato em pixels e validamos contra a viewport
           * subtraída do padding. */
          const canvas = map.getCanvas();
          const w = canvas.clientWidth;
          const h = canvas.clientHeight;
          const pad = REVEAL_VIEWPORT_PADDING_PX;
          const inView = candidates.filter((f) => {
            if (f.geometry.type !== 'Point') return false;
            const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
            const p = map.project([lng, lat]);
            return (
              p.x >= pad &&
              p.x <= w - pad &&
              p.y >= pad &&
              p.y <= h - pad
            );
          });
          if (inView.length === 0) {
            revealTimers.push(window.setTimeout(tick, REVEAL_CYCLE_MS));
            return;
          }

          /* Picker: em zoom OUT (z < 8) escolhe uma CIDADE aleatória
           * das top 50 (uniforme) e gera feature ad-hoc no centro
           * dela com pequeno offset. Per feedback "Quando estiver
           * com o zoom out, faça surgir um usuário ... de forma
           * aleatória nas cidades top 50".
           *
           * Por que não samplear inView direto: o dataset 7000 é
           * proporcional aos ouvintes mensais — SP tem 41% dos users,
           * então 41% dos spawns seriam de SP. Samplear por cidade
           * primeiro garante distribuição uniforme entre top 50,
           * incluindo Niterói, Itajaí etc — todas com igual chance
           * de aparecer. */
          const z = map.getZoom();
          const pickFeature = (): GeoJSON.Feature | null => {
            if (z >= 8) {
              return inView[Math.floor(Math.random() * inView.length)] ?? null;
            }
            // Zoom out: sample por cidade uniforme das top 50
            if (data.cities.length === 0) return null;
            const city = data.cities[Math.floor(Math.random() * data.cities.length)];
            // Verifica se a cidade está no viewport projetando o centro
            const cp = map.project(city.center as [number, number]);
            if (cp.x < pad || cp.x > w - pad || cp.y < pad || cp.y > h - pad) {
              // Cidade fora do viewport, fallback pra sample uniforme
              return inView[Math.floor(Math.random() * inView.length)] ?? null;
            }
            // Offset pequeno em ~5km pra avatar não nascer EXATAMENTE
            // no centro (visualmente menos rígido).
            const offsetDeg = 0.045;
            const lng = city.center[0] + (Math.random() - 0.5) * offsetDeg;
            const lat = city.center[1] + (Math.random() - 0.5) * offsetDeg;
            // Reaproveita nome de um candidate random (pool de nomes
            // do dataset). Avatar seed também random.
            const sampleProps = candidates.length > 0
              ? (candidates[Math.floor(Math.random() * candidates.length)].properties ?? {}) as FeatureProps
              : ({} as FeatureProps);
            return {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lng, lat] },
              properties: {
                id:         `simr-${city.city}-${Math.random().toString(36).slice(2, 8)}`,
                name:       sampleProps.name ?? 'Fã',
                avatarSeed: Math.floor(Math.random() * 64),
                online:     1,
              } as FeatureProps,
            };
          };

          /* Anti-overlap: rejeita spawn que cairia a < MIN_DISTANCE_PX
           * de qualquer marker ativo. Per feedback "Eles não devem
           * se sobrepor". MIN é grande o suficiente pra que avatar
           * (~38px) + nome + balão de direct não invadam o anterior. */
          const MIN_DISTANCE_PX = 140;
          const tryPick = (): GeoJSON.Feature | null => {
            for (let attempt = 0; attempt < 8; attempt += 1) {
              const f = pickFeature();
              if (!f) return null;
              if (f.geometry.type !== 'Point') continue;
              const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates as [number, number];
              const proj = map.project([lng, lat]);
              // Verifica distância pra cada marker ativo (em px)
              let tooClose = false;
              for (const m of activeMarkers) {
                const mPos = m.getLngLat();
                const mProj = map.project([mPos.lng, mPos.lat]);
                if (Math.hypot(proj.x - mProj.x, proj.y - mProj.y) < MIN_DISTANCE_PX) {
                  tooClose = true;
                  break;
                }
              }
              if (!tooClose) return f;
            }
            return null;  // 8 tentativas falharam — skip esse spawn
          };

          /* Stagger: cada um dos 3 spawns com delay random entre
           * 1.0-2.2s × posição. Resultado: 1º imediato, 2º entre
           * 1-2.2s, 3º entre 2-4.4s. */
          for (let i = 0; i < REVEAL_BATCH_SIZE; i++) {
            const delay =
              i === 0
                ? 0
                : i * (REVEAL_STAGGER_MIN_MS + Math.random() * (REVEAL_STAGGER_MAX_MS - REVEAL_STAGGER_MIN_MS));
            const t = window.setTimeout(() => {
              const f = tryPick();
              if (f) spawnReveal(f);
            }, delay);
            revealTimers.push(t);
          }

          /* Próximo ciclo: ~5s + duração do stagger pra não sobrepor
           * a saída dos atuais com a chegada dos próximos. */
          const nextDelay = REVEAL_CYCLE_MS + REVEAL_STAGGER_MAX_MS;
          revealTimers.push(window.setTimeout(tick, nextDelay));
        } catch {
          /* map removido entre verificações — encerra o loop. */
        }
      };

      // Kick off no próximo frame pra dar tempo dos layers
      // assentarem antes do primeiro spawn.
      revealTimers.push(window.setTimeout(tick, 1500));

      const offEvents = () => {
        try {
          map.off('mousemove', LAYER_CL, onClusterHoverT);
          map.off('mouseleave', LAYER_CL, onPointerOut);
          map.off('click', LAYER_CL, onClusterClick);
          map.off('click', onMapClick);
        } catch { /* map destruído */ }
        /* Limpa todos os timers pendentes e remove markers ativos. */
        revealTimers.forEach((t) => window.clearTimeout(t));
        revealTimers.length = 0;
        activeMarkers.forEach((m) => {
          try { m.remove(); } catch { /* já removido */ }
        });
        activeMarkers.length = 0;
      };
      // Substitui o cleanup original armazenando-o num closure.
      const originalCleanup = cleanup;
      cleanupRef.current = () => { offEvents(); originalCleanup(); };
    };

    /* Closure helper pra que o cleanup do useEffect rode tanto o
     * cleanup de layers quanto o de event listeners, mesmo que
     * `attach` substitua a função no meio. */
    const cleanupRef: { current: () => void } = { current: cleanup };

    // Subscribe pro map instance atual + futuros
    unsubscribe = globeStore.subscribeMapInstance(attach);

    return () => {
      if (unsubscribe) unsubscribe();
      cleanupRef.current();
      if (dismissTimerRef.current) {
        window.clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [enabled, data.geojson]);

  if (!hover) return null;
  if (hover.kind === 'cluster') return <ClusterHoverCard info={hover} />;
  return <HoverCard info={hover} />;
}

/* ── Hover card ─────────────────────────────────────────── */

const TIER_LABEL: Record<UserHoverInfo['tier'], string> = {
  superfan: 'Superfã',
  top100:   'Top 100',
  top1000:  'Top 1000',
  fan:      'Fã',
};

const TIER_COLOR_CSS: Record<UserHoverInfo['tier'], string> = {
  superfan: '#fbbf24',
  top100:   '#a855f7',
  top1000:  '#6366f1',
  fan:      '#9ca3af',
};

function relativeTime(sec: number): string {
  if (sec < 60) return 'agora';
  if (sec < 3600) return `há ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `há ${Math.floor(sec / 3600)} h`;
  return `há ${Math.floor(sec / 86400)} d`;
}

/* HoverCard e ClusterHoverCard memoizados via React.memo — quando
 * o pai (MapSimulationLayer) re-renderiza por outro motivo que
 * não seja mudança de `info`, o React pula a reconciliação desses
 * filhos. Em conjunto com o rAF-throttle do mousemove, corta o
 * trabalho redundante a cada 16ms de hover ativo. */
const HoverCard = memo(function HoverCard({ info }: { info: UserHoverInfo }) {
  /* Posiciona com transform pra cair logo acima do cursor.
   * pointer-events:none pra cursor sobre o card não disparar
   * mouseleave do layer (que escondia o card numa fração de
   * segundo no desktop). */
  return (
    <div
      className={styles.hoverCard}
      style={{
        left: `${info.clientX}px`,
        top:  `${info.clientY}px`,
      }}
      role="status"
      aria-live="polite"
    >
      <div className={styles.hoverHead}>
        <span
          className={`${styles.hoverDot} ${info.online ? '' : styles.hoverDotOff}`}
          aria-hidden="true"
        />
        <span className={styles.hoverName}>{info.name}</span>
      </div>
      <div className={styles.hoverMeta}>
        <span
          className={styles.hoverTierPill}
          style={{ color: TIER_COLOR_CSS[info.tier], borderColor: TIER_COLOR_CSS[info.tier] }}
        >
          {TIER_LABEL[info.tier]}
        </span>
        <span className={styles.hoverCity}>{info.city}</span>
        <span className={styles.hoverSep} aria-hidden="true">·</span>
        <span className={styles.hoverWhen}>
          {info.online ? 'online agora' : relativeTime(info.lastActiveSec)}
        </span>
      </div>
    </div>
  );
});

/* ── Cluster hover card ────────────────────────────────────
 * Aparece quando o mouse passa sobre o blob verde de um cluster.
 * Mostra apenas a contagem em um pill totalmente arredondado e
 * com largura flexível (per feedback: remover "nesta região" e
 * deixar o box responsivo, totalmente arredondado).
 */
const ClusterHoverCard = memo(function ClusterHoverCard({ info }: { info: ClusterHoverInfo }) {
  return (
    <div
      className={styles.clusterPill}
      style={{
        left: `${info.clientX}px`,
        top:  `${info.clientY}px`,
      }}
      role="status"
      aria-live="polite"
    >
      <span className={styles.hoverDot} aria-hidden="true" />
      <span className={styles.clusterPillText}>
        {info.count.toLocaleString('pt-BR')} fãs online
      </span>
    </div>
  );
});
