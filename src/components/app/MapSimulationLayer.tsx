'use client';

import { useEffect } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { globeStore } from '@/lib/globeStore';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import { useSimulationData } from '@/lib/mapSimulation';

/**
 * MapSimulationLayer — camada sandbox que renderiza 3.000 mock
 * users no mapa via Mapbox layers (heatmap + clusters + circles
 * coloridos por tier).
 *
 * Não tem JSX visível — só side-effects no map instance.
 * Mounted como qualquer componente React, gated pelo flag de
 * brainstorm `mapSimulation`. Quando flag desliga, cleanup remove
 * todas as sources/layers — zero leak.
 *
 * Bandas de zoom (LOD):
 *   - zoom 3-5   → só heatmap; clusters/dots ocultos
 *   - zoom 5-8   → clusters + heatmap esmaecido
 *   - zoom 8-11  → clusters + dots por tier
 *   - zoom 11+   → dots por tier, halo em superfãs visíveis
 *
 * Não há drift de movimento — dataset estático per product spec.
 */

const SOURCE_ID  = 'mapsim-users';
const LAYER_HEAT = 'mapsim-heatmap';
const LAYER_CL   = 'mapsim-clusters';
const LAYER_CL_T = 'mapsim-cluster-count';
const LAYER_DOT  = 'mapsim-dot';
const LAYER_HALO = 'mapsim-superfan-halo';

/** Cor do dot por tier — paleta da marca + amber pra topo. */
const TIER_COLOR_EXPR = [
  'match',
  ['get', 'tier'],
  'superfan', '#fbbf24',  // amber
  'top100',   '#a855f7',  // magenta-violet
  'top1000',  '#6366f1',  // indigo
  /* fan default */       '#9ca3af',
] as unknown[];

/** Raio do dot por tier — superfãs são maiores. */
const TIER_RADIUS_EXPR = [
  'match',
  ['get', 'tier'],
  'superfan', 6,
  'top100',   5,
  'top1000',  4,
  /* fan default */ 3.2,
] as unknown[];

export default function MapSimulationLayer() {
  const { flags } = useBrainstormFlags();
  const enabled = flags.mapSimulation;
  // Hook ALWAYS chamado (regras de Hooks) — geração só roda quando
  // a função interna é executada. Com enabled=false a função retorna
  // imediatamente sem usar `data` no efeito; e se já gerou uma vez,
  // o cache global reusa. Custo do hook em si: zero.
  const data = useSimulationData();

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
        if (currentMap.getSource(SOURCE_ID)) currentMap.removeSource(SOURCE_ID);
      } catch {
        /* mapa pode estar sendo destruído — ignorar */
      }
      currentMap = null;
    };

    const attach = (mapUnknown: unknown | null) => {
      // Mapa desmontou — limpa
      if (!mapUnknown) {
        cleanup();
        return;
      }
      const map = mapUnknown as MapboxMap;
      currentMap = map;

      // Source clusterizada — Mapbox Supercluster nativo.
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: data.geojson as GeoJSON.FeatureCollection,
          cluster: true,
          clusterRadius: 50,
          clusterMaxZoom: 10,
          // `weight` pesa pra heatmap mas Supercluster cluster_count
          // ignora — sum a parte:
          clusterProperties: {
            sum_weight: ['+', ['get', 'weight']],
            superfans:  ['+', ['case', ['==', ['get', 'tier'], 'superfan'], 1, 0]],
          },
        });
      }

      // 1) HEATMAP — atmosférico, mais forte em zoom baixo.
      if (!map.getLayer(LAYER_HEAT)) {
        map.addLayer({
          id: LAYER_HEAT,
          type: 'heatmap',
          source: SOURCE_ID,
          maxzoom: 9,
          paint: {
            'heatmap-weight': ['get', 'weight'],
            'heatmap-intensity': [
              'interpolate', ['linear'], ['zoom'],
              3, 0.6,
              5, 1,
              7, 1.4,
              9, 0.8,
            ],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0,   'rgba(0, 0, 0, 0)',
              0.2, 'rgba(99, 102, 241, 0.35)',     // indigo
              0.5, 'rgba(168, 85, 247, 0.55)',     // magenta
              0.8, 'rgba(236, 72, 153, 0.75)',     // pink
              1,   'rgba(251, 191, 36, 0.85)',     // amber (hot)
            ],
            'heatmap-radius': [
              'interpolate', ['linear'], ['zoom'],
              3, 14,
              5, 22,
              7, 30,
              9, 18,
            ],
            // Fade-out a partir de zoom 7 (clusters/dots assumem)
            'heatmap-opacity': [
              'interpolate', ['linear'], ['zoom'],
              3, 0.95,
              6, 0.85,
              7, 0.5,
              8, 0.25,
              9, 0,
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

      // 4) DOTS — pontos individuais (não-clusterizados) por tier.
      if (!map.getLayer(LAYER_DOT)) {
        map.addLayer({
          id: LAYER_DOT,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          minzoom: 7,
          paint: {
            'circle-color': TIER_COLOR_EXPR as unknown as string,
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

      // 5) HALO em superfãs — anel pulsante feito via 2º circle layer
      //    com raio maior e opacity baixa (animação leve via CSS é
      //    impossível em layer Mapbox; aqui é estático mas brilha).
      if (!map.getLayer(LAYER_HALO)) {
        map.addLayer({
          id: LAYER_HALO,
          type: 'circle',
          source: SOURCE_ID,
          filter: [
            'all',
            ['!', ['has', 'point_count']],
            ['==', ['get', 'tier'], 'superfan'],
          ],
          minzoom: 7,
          paint: {
            'circle-radius': 14,
            'circle-color': 'rgba(251, 191, 36, 0.0)',
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'rgba(251, 191, 36, 0.55)',
            'circle-opacity': [
              'interpolate', ['linear'], ['zoom'],
              7,  0,
              8,  0.6,
              14, 0.9,
            ],
          },
        }, LAYER_DOT);
      }
    };

    // Subscribe pro map instance atual + futuros
    unsubscribe = globeStore.subscribeMapInstance(attach);

    return () => {
      if (unsubscribe) unsubscribe();
      cleanup();
    };
  }, [enabled, data.geojson]);

  return null;
}
