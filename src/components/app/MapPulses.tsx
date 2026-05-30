'use client';

import { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Map as MapboxMap } from 'mapbox-gl';
import { globeStore } from '@/lib/globeStore';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import { useSimulationData, type CityStats } from '@/lib/mapSimulation';

/* ============================================================
 * MAP PULSES — Ondas pulsantes em polos urbanos com movimento.
 *
 * Per feedback "preciso de uma solução para comunicar no mapa
 * que algumas regiões do Brasil estão com movimento de fãs
 * online, mas algo sofisticado, minimalista e que não prejudique
 * a performance".
 *
 * Visual: 3 anéis concêntricos verde-marca por polo, pulsando em
 * sequência (staggered scale + fade). Cada onda parece "rádio
 * se expandindo" — sem distrair, comunica vida sem narrar.
 *
 * Tamanhos (XL/L/M) atribuídos pela contagem de `active` (online
 * < 5min) de cada cidade:
 *   - XL → ≥ 700 ativos (capitais fervilhando)
 *   - L  → 400-699
 *   - M  → 200-399
 *   - <200 → sem pulse (cidade média pra baixo já é representada
 *     pelos dots/heatmap; adicionar pulse aqui poluiria)
 *
 * Performance: DOM Markers + CSS keyframes. A animação roda no
 * compositor da GPU (transform + opacity), zero JS por frame.
 * ~5-10 markers no Brasil inteiro × 3 rings cada = ~30 elementos
 * animados — neglígivel vs os 4200 features dos dot layers.
 *
 * Gates de visibilidade:
 *   - Flag `mapSimulation` precisa estar on
 *   - CSS controla visibilidade por viewport (some via map.on('zoom'))
 *     entre zoom 8 e 9 pra dar lugar pros dots/clusters detalhados
 * ============================================================ */

/** Decide o tier de pulse pra cada cidade pela contagem de ativos. */
function pulseSize(active: number): 'xl' | 'l' | 'm' | null {
  if (active >= 700) return 'xl';
  if (active >= 400) return 'l';
  if (active >= 200) return 'm';
  return null;
}

/** Detecta mobile via viewport — mesma heurística do MapSimulationLayer. */
function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/** Cap de pulses no mobile per feedback "no mobile talvez 3 sejam
 *  suficientes" — mantém só os 3 polos mais densos pra não poluir
 *  a tela pequena nem dividir GPU à toa. */
const MAX_PULSES_MOBILE = 3;

export default function MapPulses() {
  const { flags } = useBrainstormFlags();
  const enabled = flags.mapSimulation;
  const data = useSimulationData();

  useEffect(() => {
    if (!enabled) return;

    let currentMap: MapboxMap | null = null;
    const markers: mapboxgl.Marker[] = [];
    let zoomHandler: (() => void) | null = null;

    const clearMarkers = () => {
      markers.forEach((m) => {
        try { m.remove(); } catch { /* já removido */ }
      });
      markers.length = 0;
    };

    const applyZoomVisibility = (map: MapboxMap) => {
      /* Visível em zoom 3-8, fade entre 8-9, hidden a partir de 9.
       * Usamos uma classe no .mapsim-pulse via attribute do
       * elemento root (toggled aqui em vez de CSS query @media,
       * que não tem como ler zoom do Mapbox). */
      const z = map.getZoom();
      const visible = z < 9;
      const opacity = z < 8 ? 1 : Math.max(0, 1 - (z - 8));
      markers.forEach((m) => {
        const el = m.getElement();
        el.style.opacity = String(opacity);
        el.style.visibility = visible ? 'visible' : 'hidden';
      });
    };

    const attach = (mapUnknown: unknown | null) => {
      if (!mapUnknown) {
        clearMarkers();
        if (currentMap && zoomHandler) {
          try { currentMap.off('zoom', zoomHandler); } catch { /* destruído */ }
        }
        currentMap = null;
        return;
      }
      const map = mapUnknown as MapboxMap;
      currentMap = map;

      /* Limpa markers anteriores (re-attach pode acontecer se o
       * map remontar — Globe.tsx pode trocar de instância). */
      clearMarkers();

      /* Seleciona top cidades com pulse. data.cities já vem
       * ordenado por active desc. No mobile, cap em 3 (per
       * feedback "no mobile talvez 3 sejam suficientes") —
       * tela pequena + 3 anéis cada = melhor manter discreto. */
      const mobile = isMobileViewport();
      const candidates: Array<{ city: CityStats; size: 'xl' | 'l' | 'm' }> = [];
      for (const city of data.cities) {
        const size = pulseSize(city.active);
        if (!size) continue;
        candidates.push({ city, size });
      }
      const finalList = mobile
        ? candidates.slice(0, MAX_PULSES_MOBILE)
        : candidates;

      finalList.forEach(({ city, size }) => {
        /* Estrutura:
         *   <div .mapsim-pulse .mapsim-pulse-{size}>
         *     <span .mapsim-pulse-ring />  (×3, com delays diferentes)
         *     <span .mapsim-pulse-core />
         *   </div>
         */
        const el = document.createElement('div');
        el.className = `mapsim-pulse mapsim-pulse-${size}`;
        el.setAttribute('aria-hidden', 'true');

        for (let i = 0; i < 3; i += 1) {
          const ring = document.createElement('span');
          ring.className = `mapsim-pulse-ring mapsim-pulse-ring-${i + 1}`;
          el.appendChild(ring);
        }
        const core = document.createElement('span');
        core.className = 'mapsim-pulse-core';
        el.appendChild(core);

        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center',
        })
          .setLngLat(city.center)
          .addTo(map);

        markers.push(marker);
      });

      /* Hook de zoom — toggla visibilidade conforme o usuário
       * navega. Throttle natural do Mapbox (evento 'zoom' dispara
       * só durante interação ativa). */
      zoomHandler = () => applyZoomVisibility(map);
      map.on('zoom', zoomHandler);
      applyZoomVisibility(map);
    };

    const unsubscribe = globeStore.subscribeMapInstance(attach);

    return () => {
      unsubscribe();
      clearMarkers();
      if (currentMap && zoomHandler) {
        try { currentMap.off('zoom', zoomHandler); } catch { /* destruído */ }
      }
    };
  }, [enabled, data.cities]);

  return null;
}
