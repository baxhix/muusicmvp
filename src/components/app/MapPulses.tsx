'use client';

import { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Map as MapboxMap } from 'mapbox-gl';
import { globeStore } from '@/lib/globeStore';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import { useSimulationData, type CityStats } from '@/lib/mapSimulation';
import type { Country } from '@/lib/mapSimulation/cities';

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

/** Decide o tier de pulse pra cada cidade pelo RANK ordinal no
 *  dataset (não mais por threshold de active count, que ficaria
 *  desbalanceado no CSV onde top-5 dominam massivamente).
 *
 *  Per feedback "adicione ondas pulsantes menores nas cidades que há
 *  registros. Não todas ao mesmo tempo. Intercale para a página não
 *  ficar carregada":
 *    - rank 1-5  → xl (mega-polos: SP, BH, Curitiba, Brasília, Campinas)
 *    - rank 6-15 → m  (top capitais brasileiras)
 *    - rank 16-30 → s
 *    - rank 31+   → xs (presença simbólica em todas as cidades)
 *
 *  TODAS as cidades do CSV ganham pulse — a intercalação visual
 *  (alguns ativos, outros em pausa) vem do ciclo de animation
 *  alongado no CSS + phase offsets distribuídos abaixo. */
function pulseSize(
  rank: number,
  country: Country,
): 'xl' | 'l' | 'm' | 's' | 'xs' | null {
  /* Cidades internacionais SEMPRE ganham pulse 'xs' independente do
   * rank. Razão: quando data.cities é ordenado por `active` desc,
   * as 25 internacionais (monthlyListeners 200-320 vs BR em milhões)
   * caem pra rank 50+ e várias passavam de 60 — onde o gate antigo
   * retornava null e nenhum pulse era emitido.
   *
   * Per feedback "Fora do Brasil, adicione as ondas pulsantes nos
   * pontos de concentração de ouvintes também". Cobrindo via gate
   * dedicado por país: BR mantém a escala XL/M/S/XS por rank;
   * não-BR vira xs garantido. */
  if (country !== 'BR') return 'xs';
  if (rank <= 5)  return 'xl';
  if (rank <= 15) return 'm';
  if (rank <= 30) return 's';
  if (rank <= 60) return 'xs';
  return null;
}

/** Detecta mobile via viewport — mesma heurística do MapSimulationLayer. */
function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/** Cap de pulses no mobile — todas as 50 cidades teriam custo de
 *  GPU alto na tela pequena. Mantém top 12 (os 5 xl + 7 m). */
const MAX_PULSES_MOBILE = 12;

/** Hash FNV-1a leve pra gerar números determinísticos por cidade
 *  (mesmo nome → mesma quantidade simulada de ouvintes). */
function cityHash(s: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Listeners exibidos no badge "X ouvintes" do hover do pulse.
 *
 *  Top 5 cidades: usa `active` real (proporcional ao dataset 10k →
 *  SP terá ~2400 ativos). Cidades fora do top 5: o dataset tem 0-1
 *  user real, então o badge mostraria "1 ouvinte" — feio. Per
 *  feedback "Simule com números randômicos na casa de centenas".
 *
 *  Geramos um número determinístico (hash do nome) entre 120 e 880,
 *  com leve correlação ao monthlyListeners do CSV pra cidades
 *  maiores mostrarem números um pouco maiores. */
function simulatedListeners(city: CityStats, rank: number): number {
  if (rank <= 5) return city.active;
  const seed = cityHash(city.city);
  const base = 120 + (seed % 760);  // 120 - 879
  // Bias suave pelo monthlyListeners: cidades com ml ~400-500 (rank
  // 6-15) somam +50, cidades ml < 280 (rank 30+) subtraem -30.
  const bias =
    city.monthlyListeners > 350 ? 50 :
    city.monthlyListeners < 280 ? -30 :
    0;
  return Math.max(80, base + bias);
}

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
      /* Lógica de visibilidade dos pulses por zoom:
       *   z < 2.5  → TODOS hidden (mobile pode ir até 1.5; per
       *              feedback "no mobile, em zoom menor que 2.5,
       *              oculte qualquer elemento sobre o mapa").
       *   z < 7    → XL/L como XXL (~200px), M/S/XS no tamanho original
       *   z 7-8    → modo normal (tier XL/L/M/S/XS original)
       *   z 8-9    → fade-out gradual
       *   z 9+     → hidden (zoom de cidade não precisa de pulse) */
      const z = map.getZoom();
      const tooFarOut = z < 2.5;
      const visible = !tooFarOut && z < 9;
      const opacity = tooFarOut ? 0 : (z < 8 ? 1 : Math.max(0, 1 - (z - 8)));
      markers.forEach((m) => {
        const el = m.getElement();
        const original = el.dataset.sizeOriginal as
          | 'xl' | 'l' | 'm' | 's' | 'xs' | undefined;
        if (!original) return;

        el.classList.remove(
          'mapsim-pulse-xxl',
          'mapsim-pulse-xl',
          'mapsim-pulse-l',
          'mapsim-pulse-m',
          'mapsim-pulse-s',
          'mapsim-pulse-xs',
        );

        if (z < 7) {
          /* Per feedback "Isso deve aparecer em todos os níveis de
           * zoom": pulses M/S/XS NÃO somem mais em z<7 (antes ficavam
           * hidden). XL/L viram XXL (~200px pros polos grandes);
           * M/S/XS mantêm o tamanho original — Campo Grande,
           * Florianópolis etc continuam pulsando no zoom afastado. */
          if (original === 'xl' || original === 'l') {
            el.classList.add('mapsim-pulse-xxl');
          } else {
            el.classList.add(`mapsim-pulse-${original}`);
          }
          el.style.visibility = 'visible';
        } else {
          el.classList.add(`mapsim-pulse-${original}`);
          el.style.visibility = visible ? 'visible' : 'hidden';
        }
        /* Pulse-core agora é 3×3 fixo no CSS (era 6×6 com conditional
         * .mapsim-pulse-tight-core via JS aqui). Per feedback "deve
         * ficar com 3px" — simplificado pra default global em vez de
         * gate por zoom. */
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
      const candidates: Array<{ city: CityStats; size: 'xl' | 'l' | 'm' | 's' | 'xs' }> = [];
      data.cities.forEach((city, idx) => {
        // rank ordinal (1-based) — top cidades ganham pulse maior,
        // cauda longa fica em 'xs'. pulseOverride.tier força um tier
        // específico (usado pra simular "burst de crescimento" em
        // cidades menores per feedback).
        const defaultSize = pulseSize(idx + 1, city.country);
        const size = city.pulseOverride?.tier ?? defaultSize;
        if (!size) return;
        candidates.push({ city, size });
      });
      const finalList = mobile
        ? candidates.slice(0, MAX_PULSES_MOBILE)
        : candidates;

      const fmt = (n: number) => n.toLocaleString('pt-BR');

      finalList.forEach(({ city, size }, idx) => {
        // Listeners exibidos no badge — top 5 usa active real, demais
        // usam número simulado na casa de centenas (per feedback).
        const displayCount = simulatedListeners(city, idx + 1);
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
        // Variante de cor pink/roxo per feedback "Teste ondas
        // pulsantes em 4 outros locais com outra cor".
        if (city.pulseOverride?.color === 'pink') {
          el.classList.add('mapsim-pulse-alt');
        }
        el.dataset.sizeOriginal = size;
        // Não usamos aria-hidden mais — o badge tem info útil.

        /* Phase offset POR POLO via animation-delay negativo, com
         * ciclo TOTAL de 14s (3 ondas em ~3s + ~10s de pausa idle).
         * Per feedback "Nem todas as ondas pulsantes devem ser
         * mostradas simultaneamente. Podem ocultar e aparecer depois
         * de um tempo".
         *
         * Multiplicamos idx por 2.29 (golden-ratio-ish em base 14)
         * e modulo 14 pra distribuir as 50 fases uniformemente no
         * ciclo. Resultado: só ~32% das cidades estão "no ciclo
         * ativo" a qualquer momento; o restante está dormindo.
         * Delay interno entre os 3 anéis: 0/1.0/2.0s pro stagger
         * intra-cidade. */
        const polePhase = -((idx * 2.29) % 14);
        for (let i = 0; i < 3; i += 1) {
          const ring = document.createElement('span');
          ring.className = `mapsim-pulse-ring mapsim-pulse-ring-${i + 1}`;
          ring.style.animationDelay = `${polePhase + i * 1.0}s`;
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
        hit.setAttribute('aria-label', `${city.city}: ${fmt(displayCount)} ouvintes`);
        el.appendChild(hit);

        /* Badge — pill com cidade + contagem de ouvintes. */
        const badge = document.createElement('span');
        badge.className = 'mapsim-pulse-badge';
        const cityName = document.createElement('strong');
        cityName.className = 'mapsim-pulse-badge-city';
        cityName.textContent = city.city;
        const cityCount = document.createElement('span');
        cityCount.className = 'mapsim-pulse-badge-count';
        cityCount.textContent = `${fmt(displayCount)} ouvintes`;
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
