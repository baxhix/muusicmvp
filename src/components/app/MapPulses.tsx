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

/** Decide o tier de pulse pra cada cidade pela contagem de ativos.
 *
 *  Tier S é forçado em Manaus e Belém per feedback "Adicione mais
 *  uma área pulsante menor em Belém e Manaus". Essas duas cidades
 *  não atingiriam o threshold M consistentemente (active varia
 *  por sampling) — forçar S garante presença visual sempre. */
function pulseSize(city: CityStats): 'xl' | 'l' | 'm' | 's' | null {
  if (city.city === 'Manaus' || city.city === 'Belém') return 's';
  if (city.active >= 700) return 'xl';
  if (city.active >= 400) return 'l';
  if (city.active >= 200) return 'm';
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
      /* Lógica em três faixas:
       *   zoom < 5  → modo XXL (~200px) pros polos XL/L originais.
       *               Polos M/S são escondidos (zoom continente não
       *               precisa de info detalhada).
       *   zoom 5-8  → modo normal (tier XL/L/M/S original).
       *   zoom 8-9  → fade-out gradual.
       *   zoom 9+   → hidden. */
      const z = map.getZoom();
      const visible = z < 9;
      const opacity = z < 8 ? 1 : Math.max(0, 1 - (z - 8));
      markers.forEach((m) => {
        const el = m.getElement();
        const original = el.dataset.sizeOriginal as 'xl' | 'l' | 'm' | 's' | undefined;
        if (!original) return;

        el.classList.remove(
          'mapsim-pulse-xxl',
          'mapsim-pulse-xl',
          'mapsim-pulse-l',
          'mapsim-pulse-m',
          'mapsim-pulse-s',
        );

        if (z < 5) {
          if (original === 'xl' || original === 'l') {
            el.classList.add('mapsim-pulse-xxl');
            el.style.visibility = 'visible';
          } else {
            el.style.visibility = 'hidden';
          }
        } else {
          el.classList.add(`mapsim-pulse-${original}`);
          el.style.visibility = visible ? 'visible' : 'hidden';
        }
        el.style.opacity = String(opacity);
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
      const candidates: Array<{ city: CityStats; size: 'xl' | 'l' | 'm' | 's' }> = [];
      for (const city of data.cities) {
        const size = pulseSize(city);
        if (!size) continue;
        candidates.push({ city, size });
      }
      const finalList = mobile
        ? candidates.slice(0, MAX_PULSES_MOBILE)
        : candidates;

      const fmt = (n: number) => n.toLocaleString('pt-BR');

      finalList.forEach(({ city, size }, idx) => {
        /* Estrutura final:
         *   <div .mapsim-pulse>
         *     <span .mapsim-pulse-ring />  (×3, com delays diferentes)
         *     <span .mapsim-pulse-core />
         *     <span .mapsim-pulse-hit />   ← área invisível 60×60 que
         *                                    captura mouseover
         *     <span .mapsim-pulse-badge>{count} ouvintes</span>
         *                                  ← pill mostrado no hover
         *   </div>
         * Per feedback "adicione o hover nas áreas pulsantes com o
         * badge de quantidade de ouvintes". */
        const el = document.createElement('div');
        el.className = 'mapsim-pulse';
        el.dataset.sizeOriginal = size;
        // Não usamos aria-hidden mais — o badge tem info útil.

        /* Phase offset POR POLO via animation-delay negativo.
         * Per feedback "façam com que as ondas pulsantes não
         * iniciem ao mesmo tempo. Devem ser intercaladas para
         * ter um o aspecto de individualidade".
         *
         * Ciclo total = 3.5s. Multiplicamos idx por 0.83 (não
         * múltiplo de 1.17 dos delays internos) e modulo 3.5
         * pra distribuir as fases ao longo do ciclo inteiro.
         * Delay negativo faz a animação "começar no passado",
         * então o polo já entra em meio-pulso em vez de esperar.
         *
         * Cada um dos 3 anéis ganha esse phase + seu próprio
         * delay interno (0 / 1.17 / 2.34) pra manter o stagger
         * dentro do polo. Sobrescreve a regra CSS estática
         * .mapsim-pulse-ring-N. */
        const polePhase = -((idx * 0.83) % 3.5);
        for (let i = 0; i < 3; i += 1) {
          const ring = document.createElement('span');
          ring.className = `mapsim-pulse-ring mapsim-pulse-ring-${i + 1}`;
          ring.style.animationDelay = `${polePhase + i * 1.17}s`;
          el.appendChild(ring);
        }
        const core = document.createElement('span');
        core.className = 'mapsim-pulse-core';
        el.appendChild(core);

        /* Hit-area invisível pra capturar hover. CSS aplica
         * pointer-events: auto só nesse element (o wrapper continua
         * pointer-events: none pra não bloquear pan do mapa). */
        const hit = document.createElement('span');
        hit.className = 'mapsim-pulse-hit';
        hit.setAttribute('aria-label', `${city.city}: ${fmt(city.active)} ouvintes`);
        el.appendChild(hit);

        /* Badge — pill com cidade + contagem de ouvintes. */
        const badge = document.createElement('span');
        badge.className = 'mapsim-pulse-badge';
        const cityName = document.createElement('strong');
        cityName.className = 'mapsim-pulse-badge-city';
        cityName.textContent = city.city;
        const cityCount = document.createElement('span');
        cityCount.className = 'mapsim-pulse-badge-count';
        cityCount.textContent = `${fmt(city.active)} ouvintes`;
        badge.appendChild(cityName);
        badge.appendChild(cityCount);
        el.appendChild(badge);

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
