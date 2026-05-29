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
const SOURCE_AMBIENT = 'mapsim-ambient';     // pontos sintéticos pra densidade no zoom out
const LAYER_HEAT     = 'mapsim-heatmap';
const LAYER_AMBIENT  = 'mapsim-ambient-dots'; // dots 1px/2px espalhados (zoom 3-6)
const LAYER_DOTFAR   = 'mapsim-dot-far';      // pontos 2px verdes (zoom out, sample 1/16)
const LAYER_DOTFAR2  = 'mapsim-dot-far-2';    // pontos 1px adicionais (zoom intermediário, sample 1/8 extra)
const LAYER_CL       = 'mapsim-clusters';     // BLOB orgânico verde (sem borda, blur alto)
const LAYER_CL_T     = 'mapsim-cluster-count'; // texto só no hover
const LAYER_DOTGLOW  = 'mapsim-dot-glow';     // halo verde difuso em volta dos dots (zoom alto)
const LAYER_DOT      = 'mapsim-dot';
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
      // Alterna entre 1px (size 0.5) e 2px (size 1) por paridade.
      const size = (i + j) % 2 === 0 ? 1 : 0.5;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { size, ambient: true },
      });
    }
  }
  return features;
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

/* Cor do dot: TODOS verdes.
 *
 * Per feedback "deixe todos verdes, se a pessoa está offline num
 * primeiro momento não interessa muito". A lógica de cor por tier
 * foi removida — o dot agora é o sinal puro de "presença online".
 * A diferenciação de tier sobrevive em:
 *   - tamanho do dot (TIER_RADIUS_EXPR abaixo)
 *   - halo dourado em superfãs (LAYER_HALO, desktop)
 *   - mini avatar de foto real em superfãs (LAYER_SF_PIC)
 *
 * O LAYER_DOT também recebe filtro `online === 1` mais abaixo —
 * offline simplesmente não pinta. Mantemos os offline no source
 * porque o heatmap usa o dataset completo (com peso menor).
 */
const DOT_COLOR_EXPR = '#3DDB74';

/** Raio do dot por tier.
 *
 *  Superfã mantém o tamanho original (6) — eles também recebem o
 *  mini avatar de foto real por cima (LAYER_SF_PIC), então o dot
 *  é a "moldura verde" embaixo da foto.
 *
 *  Os demais tiers foram cortados pela metade per feedback —
 *  buscando uma malha mais densa e menos pesada visualmente quando
 *  o mapa tem milhares de pontos verdes simultâneos. Tamanhos antes
 *  vs depois:
 *    top100   5    → 2.5
 *    top1000  4.2  → 2.1
 *    fan      3.5  → 1.75
 */
const TIER_RADIUS_EXPR = [
  'match',
  ['get', 'tier'],
  'superfan', 6,
  'top100',   2.5,
  'top1000',  2.1,
  /* fan default */ 1.75,
] as unknown[];

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
          LAYER_SF_PIC, LAYER_HALO, LAYER_DOT, LAYER_DOTGLOW,
          LAYER_CL_T, LAYER_CL, LAYER_DOTFAR2, LAYER_DOTFAR,
          LAYER_AMBIENT, LAYER_HEAT,
        ]) {
          if (currentMap.getLayer(id)) currentMap.removeLayer(id);
        }
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
      if (!map.getLayer(LAYER_AMBIENT)) {
        map.addLayer({
          id: LAYER_AMBIENT,
          type: 'circle',
          source: SOURCE_AMBIENT,
          maxzoom: 7,
          paint: {
            'circle-radius': ['get', 'size'] as unknown as number,
            'circle-color': '#3DDB74',
            'circle-stroke-width': 0,
            'circle-opacity': [
              'interpolate', ['linear'], ['zoom'],
              3,   0.55,
              4,   0.55,
              5,   0.45,
              6,   0.25,
              7,   0,
            ],
          },
        });
      }

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
      if (!map.getLayer(LAYER_DOTFAR)) {
        map.addLayer({
          id: LAYER_DOTFAR,
          type: 'circle',
          source: SOURCE_HEAT,
          maxzoom: 12,
          filter: [
            'all',
            ['==', ['get', 'online'], 1],
            ['==', ['%', ['get', 'avatarSeed'], 16], 0],
          ],
          paint: {
            'circle-radius': 1,                      // 2px diameter
            'circle-color': '#3DDB74',
            'circle-stroke-width': 0,
            /* Opacity progressiva conforme zoom — soft no continente
             * (continentes pequenos pra ver muito ponto), full no
             * zoom de cidade. Per feedback "conforme o zoom avança
             * os pontos se aproximam". */
            'circle-opacity': [
              'interpolate', ['linear'], ['zoom'],
              3,   0.45,    // soft no zoom out
              5,   0.75,
              8,   0.95,
              10,  0.95,
              11,  0.80,
              12,  0,
            ],
          },
        });
      }

      // 2b) DOTS-FAR-2 — pontinhos 1px ADICIONAIS no zoom intermediário.
      //
      //     Per feedback "nesse tipo de zoom, deixe pontos de 1px e
      //     2px visíveis também" — o screenshot do zoom Brasília
      //     mostrava poucos pontos espalhados; sentia falta de
      //     densidade. Esse layer dobra a quantidade de dots na
      //     faixa zoom 9-12, mas com raio menor (0.5 = 1px diâmetro)
      //     pra criar uma textura mista (2px + 1px) sem virar massa.
      //
      //     Filter `avatarSeed % 8 == 0 AND % 16 != 0` pega 4 valores
      //     do mod 8 (8, 24, 40, 56) que NÃO estão no LAYER_DOTFAR
      //     (que usa mod 16). Resultado: outros ~437 dots adicionais
      //     → total ~874 nessa zona. minzoom 9 = só aparece quando
      //     o zoom já é alto o suficiente pra pontos de 1px serem
      //     perceptíveis.
      if (!map.getLayer(LAYER_DOTFAR2)) {
        map.addLayer({
          id: LAYER_DOTFAR2,
          type: 'circle',
          source: SOURCE_HEAT,
          /* Antes minzoom 9 — agora 7 com ramp progressivo
           * per feedback "conforme o zoom vai ocorrendo, vai
           * espalhando e mostrando novos pontos de 1px".
           * Cada incremento de zoom revela mais pontos: zoom 7
           * já mostra 30%, zoom 9 mostra 65%, peak em 10-11. */
          minzoom: 7,
          maxzoom: 12,
          filter: [
            'all',
            ['==', ['get', 'online'], 1],
            ['==', ['%', ['get', 'avatarSeed'], 8], 0],
            ['!=', ['%', ['get', 'avatarSeed'], 16], 0],
          ],
          paint: {
            'circle-radius': 0.5,                    // 1px diameter
            'circle-color': '#3DDB74',
            'circle-stroke-width': 0,
            'circle-opacity': [
              'interpolate', ['linear'], ['zoom'],
              7,   0,
              8,   0.30,    // começam tímidos
              9,   0.65,    // mais visíveis
              10,  0.85,    // peak
              11,  0.85,
              12,  0,
            ],
          },
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
      if (!map.getLayer(LAYER_CL)) {
        map.addLayer({
          id: LAYER_CL,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          minzoom: 5,
          paint: {
            'circle-color': '#3DDB74',
            /* Raio ~50% maior + blur 1.4 (> 1.0): cada cluster vira
             * um halo MUITO difuso, sem core sólido. Junto com a
             * opacity drasticamente reduzida, o LAYER_CL deixa de
             * pintar "círculos verdes" e vira só um leve adicional
             * sobre o heatmap. */
            'circle-radius': [
              'step', ['get', 'point_count'],
              36,                              // < 50  (era 24)
              50,  52,                         //       (era 34)
              200, 72,                         //       (era 48)
              500, 96,                         //       (era 64)
            ],
            'circle-stroke-width': 0,
            'circle-blur': 1.4,                // era 1.0 — mais difuso
            /* Opacity DRASTICAMENTE reduzida em todos os zooms.
             * Per feedback "as formas ainda estão bem evidentes" — o
             * heatmap deve dominar a comunicação visual, o LAYER_CL
             * passa a ser ornamento mínimo (max 0.15). */
            'circle-opacity': [
              'interpolate', ['linear'], ['zoom'],
              5,   0,
              5.5, 0.12,                       // era 0.55
              7,   0.15,                       // era 0.50
              8,   0.12,                       // era 0.25
              10,  0.10,                       // era 0.18
              11,  0,
              12,  0,
            ],
          },
        });
      }

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

      // 4a) DOT GLOW — halo verde difuso embaixo de cada dot online.
      //
      //     Per feedback "no zoom máximo, deixe esse tipo de
      //     intensidade verde ao redor dos pontos" (referenciando
      //     o halo brilhante dos avatares revelados).
      //
      //     Camada extra ANTES do LAYER_DOT pra ficar por baixo.
      //     Raio bem maior que o dot real (8-18px) + circle-blur
      //     0.85 cria fade gradient orgânico. Cor verde sólida +
      //     opacity controlada por zoom: invisível em zoom 7,
      //     ramp até 0.55 no zoom 14+. Resultado: cada ponto ganha
      //     uma "auréola" que casa visualmente com o halo dos
      //     superfãs (LAYER_HALO) e dos avatares revelados.
      /* DOTGLOW só no desktop — circle-blur 0.85 em ~4200 features
       * é o layer mais caro do conjunto. Mobile pula ele inteiro
       * (similar ao LAYER_HALO que já é desktop-only). Visualmente
       * o LAYER_DOT verde continua aparecendo; só perde a auréola
       * difusa do glow no zoom 10-13 — trade aceitável pelo ganho
       * de ~30-40% no GPU em iPhones intermediários. */
      if (!mobile && !map.getLayer(LAYER_DOTGLOW)) {
        map.addLayer({
          id: LAYER_DOTGLOW,
          type: 'circle',
          source: SOURCE_ID,
          filter: [
            'all',
            ['!', ['has', 'point_count']],
            ['==', ['get', 'online'], 1],
          ],
          minzoom: 9,
          /* Maxzoom 15 — per feedback "no zoom máximo, remova o
           * blur ao redor dos pontos". O glow é útil no zoom
           * intermediário pra dar presença aos dots pequenos,
           * mas no zoom alto cada ponto já tem raio próprio
           * suficiente e a auréola começa a poluir. */
          maxzoom: 15,
          paint: {
            'circle-color': '#3DDB74',
            /* Raio por tier — superfã ganha glow maior (alinha com
             * o halo permanente que ele tem). */
            'circle-radius': [
              'match', ['get', 'tier'],
              'superfan', 18,
              'top100',   12,
              'top1000',  10,
              /* fan default */ 9,
            ],
            'circle-blur': 0.85,
            'circle-stroke-width': 0,
            /* Opacity faz peak no zoom 12-13 e cai pra zero em 15.
             * No zoom 15+ os pontos ficam limpos, sem blur. */
            'circle-opacity': [
              'interpolate', ['linear'], ['zoom'],
              9,    0,
              11,   0.35,
              13,   0.45,
              14,   0.20,
              15,   0,
            ],
          },
        });
      }

      // 4) DOTS — pontos individuais (não-clusterizados), TODOS
      //    verdes. Filtro online=1 esconde offline do display por
      //    completo (per feedback "se a pessoa está offline num
      //    primeiro momento não interessa muito"). Offline continua
      //    contribuindo pro heatmap, só não aparece como dot.
      //    Stroke preto foi removido — em raios pequenos (1.75)
      //    ele engolia a cor verde. Agora o dot é verde puro e
      //    ganha contorno pelo LAYER_DOTGLOW logo abaixo.
      if (!map.getLayer(LAYER_DOT)) {
        map.addLayer({
          id: LAYER_DOT,
          type: 'circle',
          source: SOURCE_ID,
          filter: [
            'all',
            ['!', ['has', 'point_count']],
            ['==', ['get', 'online'], 1],
          ],
          minzoom: 7,
          paint: {
            'circle-color': DOT_COLOR_EXPR,
            'circle-radius': TIER_RADIUS_EXPR as unknown as number,
            'circle-stroke-width': 0,
            'circle-opacity': [
              'interpolate', ['linear'], ['zoom'],
              7,    0,
              8,    0.9,
              16,   1,
            ],
          },
        });
      }

      // 5) HALO em superfãs ONLINE — anel verde em volta. SÓ desktop;
      //    mobile pula esse layer pra economizar GPU (alpha-blended
      //    circle render é caro com muitos superfãs no viewport).
      //    Halo agora é VERDE (não mais amber) pra alinhar com a
      //    paleta "tudo online é verde".
      if (!mobile && !map.getLayer(LAYER_HALO)) {
        map.addLayer({
          id: LAYER_HALO,
          type: 'circle',
          source: SOURCE_ID,
          filter: [
            'all',
            ['!', ['has', 'point_count']],
            ['==', ['get', 'tier'], 'superfan'],
            ['==', ['get', 'online'], 1],
          ],
          minzoom: 9,
          paint: {
            'circle-radius': 14,
            'circle-color': 'rgba(61, 219, 116, 0.0)',
            'circle-stroke-width': 1.4,
            'circle-stroke-color': 'rgba(61, 219, 116, 0.65)',
            'circle-opacity': [
              'interpolate', ['linear'], ['zoom'],
              9,  0,
              10, 0.6,
              14, 0.95,
            ],
          },
        }, LAYER_DOT);
      }

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
       * LAYER_DOT: mousemove sobre dot → seta hover info (user).
       * LAYER_CL : mousemove sobre blob → seta hover info (cluster
       *            com point_count). Per feedback "mostre essa
       *            informação apenas se passar o mouse por cima".
       * Mobile usa click + auto-dismiss 4s; click no map vazio limpa.
       */
      const onUserHover = (e: MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return;
        const f = e.features[0];
        const p = f.properties ?? {};
        if (dismissTimerRef.current) {
          window.clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = null;
        }
        setHover({
          kind: 'user',
          id: String(p.id ?? ''),
          name: String(p.name ?? '—'),
          city: String(p.city ?? ''),
          tier: (p.tier as UserHoverInfo['tier']) || 'fan',
          online: p.online === 1 || p.online === true,
          lastActiveSec: Number(p.lastActiveSec ?? 0),
          clientX: e.originalEvent.clientX,
          clientY: e.originalEvent.clientY,
        });
        map.getCanvas().style.cursor = 'pointer';
      };

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

      const onDotClick = (e: MapLayerMouseEvent) => {
        onUserHover(e);
        if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = window.setTimeout(() => {
          setHover(null);
          map.getCanvas().style.cursor = '';
          dismissTimerRef.current = null;
        }, 4000);
        (e as unknown as { _dotHandled?: boolean })._dotHandled = true;
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
       * 1 chamada por frame (~16ms / 60Hz cap). Mapbox dispara
       * mousemove em cada pixel — sem throttle, o setHover do
       * onUserHover (4200 features pra hit-test) re-renderiza
       * o React com a mesma frequência. Quick win de performance. */
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
      const onUserHoverT    = rafThrottle(onUserHover);
      const onClusterHoverT = rafThrottle(onClusterHover);

      map.on('mousemove', LAYER_DOT, onUserHoverT);
      map.on('mouseleave', LAYER_DOT, onPointerOut);
      map.on('click', LAYER_DOT, onDotClick);
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

      const REVEAL_MIN_ZOOM        = 10;
      const REVEAL_BATCH_SIZE      = 3;
      const REVEAL_CYCLE_MS        = 5000;
      const REVEAL_STAGGER_MIN_MS  = 1000;
      const REVEAL_STAGGER_MAX_MS  = 2200;
      const REVEAL_LIFETIME_MS     = 10000;  // per feedback "aumente para 10s"
      const REVEAL_EXIT_MS         = 500;    // saída também mais suave (era 400)
      const REVEAL_MAX_ACTIVE      = 6;
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
          btn.setAttribute('aria-label', `Enviar ${emoji} para ${firstName}`);
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            /* Dispara a cascata mocada do emoji escolhido. O
             * HeartsCascade montado pelo SimulationHUD escuta esse
             * evento. `text` sobrescreve `icon` — qualquer emoji
             * cai como glyph. */
            try {
              window.dispatchEvent(
                new CustomEvent('app:hearts-cascade', { detail: { text: emoji } }),
              );
            } catch { /* SSR / detached — ignorar */ }
            /* Após escolher uma reaction, fecha o box e reagenda
             * a saída pra 1.5s (tempo curto pra usuário ver o
             * efeito completar antes do avatar sumir). */
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

        /* Hover-to-open NO DESKTOP. Per feedback "para aparecer
         * os emojis, no desktop, basta o hover". Em touch devices
         * o hover é simulado depois do tap e atrapalha — então
         * só anexamos esses listeners se `(hover: hover)` matches.
         *
         * Eventos no `photoWrap` (que contém photo + reaction box)
         * pra que ao mover o mouse DA foto PRO emoji o mouseleave
         * não dispare (o destino ainda está dentro do wrap). */
        if (supportsHover) {
          photoWrap.addEventListener('mouseenter', () => {
            openBox();
          });
          photoWrap.addEventListener('mouseleave', () => {
            closeBox();
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
          if (map.getZoom() < REVEAL_MIN_ZOOM) {
            revealTimers.push(window.setTimeout(tick, REVEAL_CYCLE_MS));
            return;
          }
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

          /* Stagger: cada um dos 3 spawns com delay random entre
           * 1.0-2.2s × posição. Resultado: 1º imediato, 2º entre
           * 1-2.2s, 3º entre 2-4.4s. */
          for (let i = 0; i < REVEAL_BATCH_SIZE; i++) {
            const delay =
              i === 0
                ? 0
                : i * (REVEAL_STAGGER_MIN_MS + Math.random() * (REVEAL_STAGGER_MAX_MS - REVEAL_STAGGER_MIN_MS));
            const t = window.setTimeout(() => {
              const f = inView[Math.floor(Math.random() * inView.length)];
              spawnReveal(f);
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
          map.off('mousemove', LAYER_DOT, onUserHoverT);
          map.off('mouseleave', LAYER_DOT, onPointerOut);
          map.off('click', LAYER_DOT, onDotClick);
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
