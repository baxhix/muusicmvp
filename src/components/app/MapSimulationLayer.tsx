'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap, MapLayerMouseEvent, MapMouseEvent } from 'mapbox-gl';
import { globeStore } from '@/lib/globeStore';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import { useSimulationData } from '@/lib/mapSimulation';
import styles from './SimulationHUD.module.css';

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
const SOURCE_ID   = 'mapsim-users';
const SOURCE_HEAT = 'mapsim-users-heat';
const LAYER_HEAT  = 'mapsim-heatmap';
const LAYER_CL    = 'mapsim-clusters';
const LAYER_CL_T  = 'mapsim-cluster-count';
const LAYER_DOT   = 'mapsim-dot';
const LAYER_HALO  = 'mapsim-superfan-halo';

/* Cor do dot:
 *  - online (lastActiveSec < 300, denormalizado em `online === 1`):
 *    VERDE (#3DDB74) — sinal forte de "tá aqui agora", per
 *    product feedback "o que representar usuário online deixe na
 *    cor verde".
 *  - offline: cor por tier (paleta da marca + amber pra topo).
 *
 * Tier ainda comunicado via size do dot + halo (desktop).
 */
const DOT_COLOR_EXPR = [
  'case',
  ['==', ['get', 'online'], 1],
  '#3DDB74',                       // online = verde
  /* offline → cor por tier */
  ['match',
    ['get', 'tier'],
    'superfan', '#fbbf24',         // amber
    'top100',   '#a855f7',         // magenta-violet
    'top1000',  '#6366f1',         // indigo
    /* fan default */              '#9ca3af',
  ],
] as unknown[];

/** Raio do dot por tier — superfãs são maiores. */
const TIER_RADIUS_EXPR = [
  'match',
  ['get', 'tier'],
  'superfan', 6,
  'top100',   5,
  'top1000',  4.2,
  /* fan default */ 3.5,
] as unknown[];

interface HoverInfo {
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
        for (const id of [LAYER_HALO, LAYER_DOT, LAYER_CL_T, LAYER_CL, LAYER_HEAT]) {
          if (currentMap.getLayer(id)) currentMap.removeLayer(id);
        }
        if (currentMap.getSource(SOURCE_HEAT)) currentMap.removeSource(SOURCE_HEAT);
        if (currentMap.getSource(SOURCE_ID)) currentMap.removeSource(SOURCE_ID);
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

      /* Dataset subsamplado pra GPU móvel — sample determinística
       * (cada 3º point). Com 7.000 users desktop, mobile fica em
       * ~2.333 features, próximo do que rodava bem na primeira
       * versão (3000 sem subsample, mas aquilo já esquentava).
       * Cobertura geográfica preservada — cada cidade ainda
       * contribui 1/3 dos seus users. */
      const sourceData = mobile
        ? {
            ...data.geojson,
            features: data.geojson.features.filter((_, i) => i % 3 === 0),
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
          maxzoom: 8,
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
              3, 0.85,
              5, 1.40,
              6, 1.30,
              7, 0.80,
              8, 0.30,
            ],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0,    'rgba(0, 0, 0, 0)',
              0.10, 'rgba(99, 102, 241, 0.32)',    // indigo (sertão)
              0.30, 'rgba(168, 85, 247, 0.55)',    // magenta
              0.55, 'rgba(236, 72, 153, 0.75)',    // pink
              0.80, 'rgba(251, 146, 60, 0.85)',    // orange
              1,    'rgba(251, 191, 36, 0.92)',    // amber (hot — capital fervilhando)
            ],
            'heatmap-radius': [
              'interpolate', ['linear'], ['zoom'],
              3, 18,
              5, 28,
              6, 30,
              7, 26,
              8, 18,
            ],
            'heatmap-opacity': [
              'interpolate', ['linear'], ['zoom'],
              3,   0.95,
              5,   0.95,
              6,   0.80,
              7,   0.45,
              8,   0,
            ],
          },
        });
      }

      // 2) CLUSTERS — começam em zoom 5, atrelado ao Supercluster.
      if (!map.getLayer(LAYER_CL)) {
        map.addLayer({
          id: LAYER_CL,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          minzoom: 5,
          paint: {
            'circle-color': [
              'step', ['get', 'point_count'],
              'rgba(99, 102, 241, 0.95)',   // < 50
              50,  'rgba(168, 85, 247, 0.95)',
              200, 'rgba(236, 72, 153, 0.95)',
              500, 'rgba(251, 191, 36, 0.95)',
            ],
            'circle-radius': [
              'step', ['get', 'point_count'],
              16,                            // < 50
              50,  20,
              200, 26,
              500, 32,
            ],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'rgba(255, 255, 255, 0.25)',
            'circle-opacity': [
              'interpolate', ['linear'], ['zoom'],
              5,   0,
              5.5, 1,
              11,  1,
              12,  0,
            ],
          },
        });
      }

      // 3) CLUSTER COUNT — texto branco grande sobre o cluster.
      if (!map.getLayer(LAYER_CL_T)) {
        map.addLayer({
          id: LAYER_CL_T,
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          minzoom: 5,
          layout: {
            'text-field': ['number-format', ['get', 'point_count'], {}],
            'text-size': [
              'step', ['get', 'point_count'],
              12,
              50,  13,
              200, 14,
              500, 16,
            ],
            'text-font': ['Inter Semibold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0, 0, 0, 0.6)',
            'text-halo-width': 1,
            'text-opacity': [
              'interpolate', ['linear'], ['zoom'],
              5,   0,
              5.5, 1,
              11,  1,
              12,  0,
            ],
          },
        });
      }

      // 4) DOTS — pontos individuais (não-clusterizados).
      //    Cor: VERDE pra online, cor por tier pra offline.
      if (!map.getLayer(LAYER_DOT)) {
        map.addLayer({
          id: LAYER_DOT,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          minzoom: 7,
          paint: {
            'circle-color': DOT_COLOR_EXPR as unknown as string,
            'circle-radius': TIER_RADIUS_EXPR as unknown as number,
            'circle-stroke-width': 1.2,
            'circle-stroke-color': 'rgba(0, 0, 0, 0.45)',
            'circle-opacity': [
              'interpolate', ['linear'], ['zoom'],
              7,    0,
              8,    0.9,
              16,   1,
            ],
          },
        });
      }

      // 5) HALO em superfãs — anel estático em volta de cada dot
      //    superfan. SÓ desktop; mobile pula esse layer pra economizar
      //    GPU (alpha-blended circle render é caro com muitos
      //    superfãs no viewport). Per feedback "celular esquentando".
      if (!mobile && !map.getLayer(LAYER_HALO)) {
        map.addLayer({
          id: LAYER_HALO,
          type: 'circle',
          source: SOURCE_ID,
          filter: [
            'all',
            ['!', ['has', 'point_count']],
            ['==', ['get', 'tier'], 'superfan'],
          ],
          minzoom: 9,
          paint: {
            'circle-radius': 11,
            'circle-color': 'rgba(251, 191, 36, 0.0)',
            'circle-stroke-width': 1.2,
            'circle-stroke-color': 'rgba(251, 191, 36, 0.5)',
            'circle-opacity': [
              'interpolate', ['linear'], ['zoom'],
              9,  0,
              10, 0.5,
              14, 0.85,
            ],
          },
        }, LAYER_DOT);
      }

      /* ── Hover/click handlers no LAYER_DOT ────────────────
       * Desktop: mousemove sobre dot → seta hover info, cursor
       * pointer, mouseleave volta. Mobile: click sobre dot →
       * seta info + timer de 4s pra auto-dismiss. Click em map
       * vazio dismissa.
       */
      const onPointerOver = (e: MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return;
        const f = e.features[0];
        const p = f.properties ?? {};
        if (dismissTimerRef.current) {
          window.clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = null;
        }
        setHover({
          id: String(p.id ?? ''),
          name: String(p.name ?? '—'),
          city: String(p.city ?? ''),
          tier: (p.tier as HoverInfo['tier']) || 'fan',
          online: p.online === 1 || p.online === true,
          lastActiveSec: Number(p.lastActiveSec ?? 0),
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
        onPointerOver(e);
        // No mobile não tem mouseleave — auto-dismiss em 4s
        if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = window.setTimeout(() => {
          setHover(null);
          map.getCanvas().style.cursor = '';
          dismissTimerRef.current = null;
        }, 4000);
        // stopPropagation impede o click global abaixo de dismissar
        // o card que acabamos de abrir.
        (e as unknown as { _dotHandled?: boolean })._dotHandled = true;
      };

      const onMapClick = (e: MapMouseEvent) => {
        // Se o click foi tratado pelo handler do LAYER_DOT acima,
        // não fechamos o card.
        if ((e as unknown as { _dotHandled?: boolean })._dotHandled) return;
        setHover(null);
        if (dismissTimerRef.current) {
          window.clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = null;
        }
      };

      map.on('mousemove', LAYER_DOT, onPointerOver);
      map.on('mouseleave', LAYER_DOT, onPointerOut);
      map.on('click', LAYER_DOT, onDotClick);
      map.on('click', onMapClick);

      // Cleanup desses handlers ao desligar a layer.
      const offEvents = () => {
        try {
          map.off('mousemove', LAYER_DOT, onPointerOver);
          map.off('mouseleave', LAYER_DOT, onPointerOut);
          map.off('click', LAYER_DOT, onDotClick);
          map.off('click', onMapClick);
        } catch { /* map destruído */ }
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

  return <HoverCard info={hover} />;
}

/* ── Hover card ─────────────────────────────────────────── */

const TIER_LABEL: Record<HoverInfo['tier'], string> = {
  superfan: 'Superfã',
  top100:   'Top 100',
  top1000:  'Top 1000',
  fan:      'Fã',
};

const TIER_COLOR_CSS: Record<HoverInfo['tier'], string> = {
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

function HoverCard({ info }: { info: HoverInfo }) {
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
}
