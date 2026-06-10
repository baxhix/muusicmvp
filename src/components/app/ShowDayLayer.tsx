'use client';

import { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Map as MapboxMap } from 'mapbox-gl';
import { globeStore } from '@/lib/globeStore';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import { track } from '@/lib/analytics';
import {
  SHOW_DAY,
  formatCountdownShort,
  formatViewers,
  getShowDayBounds,
  getShowDayPhase,
  getShowDayViewers,
  type ShowDayPhase,
} from '@/lib/showDay';
import styles from './ShowDayLayer.module.css';

/* ============================================================
 * HOJE TEM SHOW — camada visual do marker da Fire Arena.
 *
 * Híbrido nativo + DOM, seguindo a receita do MapPulses
 * (subscribeMapInstance, render null, cleanup completo — ZERO
 * mudanças no Globe.tsx):
 *
 *   • 2 circle layers nativas (halo blur + core) — tier "longe",
 *     visíveis em TODOS os zooms, escala via interpolate.
 *   • 1 DOM marker — tiers "mid" (glyph + chip) e "near" (arena
 *     simbólica + holofotes varrendo). Visibilidade por
 *     data-tier com cross-fade CSS (sem pop-in).
 *
 * Tiers de zoom:
 *   z < 2.5   hidden (só nativo — precedente MapPulses mobile)
 *   2.5–4     far    (só nativo; DOM opacity 0)
 *   4–10      mid    (glyph 22px + chip + anéis de pulso)
 *   ≥ 10      near   (arena + feixes + chip status + viewers)
 *
 * Fases (relógio local, sempre "hoje" — ver lib/showDay.ts):
 *   announced → rosa, pulso lento, countdown no chip
 *   live      → "● AO VIVO" vermelho, feixes varrendo, viewers
 *   ended     → esmaecido estático, "SHOW ENCERRADO"
 *
 * Performance: zero JS-per-frame. Toda animação é CSS keyframe
 * (transform/opacity); o JS é um interval de 30s (fase/countdown
 * de minuto) + um zoom handler O(1) que só escreve data-tier
 * quando o tier muda.
 * ============================================================ */

const SOURCE_ID = 'show-day';
const HALO_LAYER = 'show-day-halo';
const CORE_LAYER = 'show-day-core';

const TIER_FAR_MIN = 2.5;
const TIER_MID_MIN = 4; // = COMPACT_ZOOM_THRESHOLD do Globe
const TIER_NEAR_MIN = 10;

type Tier = 'hidden' | 'far' | 'mid' | 'near';

const PHASE_HALO_COLOR: Record<ShowDayPhase, string> = {
  announced: '#ec4899',
  live: '#f43f5e',
  ended: 'rgba(148, 163, 184, 0.8)',
};

function tierFor(zoom: number): Tier {
  if (zoom < TIER_FAR_MIN) return 'hidden';
  if (zoom < TIER_MID_MIN) return 'far';
  if (zoom < TIER_NEAR_MIN) return 'mid';
  return 'near';
}

/** Texto do chip de status por fase (countdown atualiza a cada 30s). */
function chipContent(phase: ShowDayPhase): { text: string; sub: string } {
  if (phase === 'live') return { text: 'AO VIVO', sub: '' };
  if (phase === 'ended') {
    return { text: 'SHOW ENCERRADO', sub: `· hoje ${SHOW_DAY.startHour}h` };
  }
  const { startsAt } = getShowDayBounds();
  const ms = startsAt.getTime() - Date.now();
  return { text: 'HOJE TEM SHOW', sub: `· em ${formatCountdownShort(ms)}` };
}

/** Palco de festival simbólico (tier near): torres de treliça (truss)
 *  nas laterais, telão de LED central, line-arrays pendurados,
 *  luminárias na treliça superior (de onde saem os feixes) e o palco
 *  com escada. Estrutura em índigo claro pra ler sobre o mapa escuro;
 *  telão no gradiente magenta/roxo do tema. Ids de gradiente fixos são
 *  seguros — só existe UMA instância deste marker no app. */
const ARENA_SVG = `
<svg viewBox="0 0 128 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="sdScreenGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c084fc"/>
      <stop offset="0.5" stop-color="#e879f9"/>
      <stop offset="1" stop-color="#f472b6"/>
    </linearGradient>
    <linearGradient id="sdDeckGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4338ca"/>
      <stop offset="1" stop-color="#1e1b4b"/>
    </linearGradient>
    <radialGradient id="sdGlowGrad" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ec4899" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#ec4899" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sdPoolP" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#a855f7" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#a855f7" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sdPoolK" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ec4899" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#ec4899" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <style>
    .sdPool{transform-box:fill-box;transform-origin:center;mix-blend-mode:screen;animation:sdsvgPool 3.2s ease-in-out infinite}
    .sdPoolB{animation-duration:3.8s;animation-delay:-1.2s}
    .sdPoolC{animation-duration:4.4s;animation-delay:-.6s}
    .sdLens{animation:sdsvgLens 2.2s ease-in-out infinite}
    @keyframes sdsvgPool{0%,100%{opacity:.5;transform:scaleX(1)}50%{opacity:.85;transform:scaleX(1.14)}}
    @keyframes sdsvgLens{0%,100%{opacity:.55}50%{opacity:1}}
    @media (max-width:768px){.sdPool,.sdLens{animation:none}}
    @media (prefers-reduced-motion:reduce){.sdPool,.sdLens{animation:none}}
  </style>

  <!-- Cobertura / teto arqueado -->
  <path d="M14 18 Q64 1 114 18 L114 21 Q64 5 14 21 Z" fill="url(#sdDeckGrad)" stroke="#a5b4fc" stroke-width="0.8" stroke-opacity="0.45"/>
  <path d="M16 17.5 Q64 2.5 112 17.5" fill="none" stroke="#c4b5fd" stroke-width="1.1" stroke-opacity="0.75"/>

  <!-- Glow de fundo do palco -->
  <ellipse cx="64" cy="42" rx="42" ry="30" fill="url(#sdGlowGrad)" opacity="0.5"/>

  <!-- Telão de LED -->
  <rect x="40" y="30" width="48" height="28" rx="2.5" fill="url(#sdScreenGrad)" opacity="0.92"/>
  <g stroke="#fdf4ff" stroke-opacity="0.2" stroke-width="0.7">
    <line x1="43" y1="38" x2="85" y2="38"/><line x1="43" y1="44" x2="85" y2="44"/><line x1="43" y1="50" x2="85" y2="50"/>
  </g>
  <rect x="40" y="30" width="48" height="28" rx="2.5" fill="none" stroke="#fce7f3" stroke-width="1" stroke-opacity="0.55"/>

  <!-- Line-arrays pendurados (flanqueando o telão) -->
  <g fill="url(#sdDeckGrad)" stroke="#a5b4fc" stroke-width="0.7" stroke-opacity="0.6">
    <line x1="33" y1="25" x2="33" y2="30" stroke="#a5b4fc" stroke-width="1" stroke-opacity="0.7"/>
    <rect x="30" y="30" width="6" height="4" rx="1"/><rect x="30.3" y="34.6" width="5.4" height="4" rx="1"/><rect x="30.6" y="39.2" width="4.8" height="4" rx="1"/><rect x="30.9" y="43.8" width="4.2" height="4" rx="1"/>
    <line x1="95" y1="25" x2="95" y2="30" stroke="#a5b4fc" stroke-width="1" stroke-opacity="0.7"/>
    <rect x="92" y="30" width="6" height="4" rx="1"/><rect x="92.3" y="34.6" width="5.4" height="4" rx="1"/><rect x="92.6" y="39.2" width="4.8" height="4" rx="1"/><rect x="92.9" y="43.8" width="4.2" height="4" rx="1"/>
  </g>

  <!-- Torres de treliça (dupla) + viga superior -->
  <g stroke="#a5b4fc" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.9">
    <path d="M18 20V76M26 20V76"/>
    <path d="M18 20H26M18 34H26M18 48H26M18 62H26M18 76H26"/>
    <path d="M18 20 26 34M26 20 18 34M18 34 26 48M26 34 18 48M18 48 26 62M26 48 18 62M18 62 26 76M26 62 18 76"/>
    <path d="M102 20V76M110 20V76"/>
    <path d="M102 20H110M102 34H110M102 48H110M102 62H110M102 76H110"/>
    <path d="M102 20 110 34M110 20 102 34M102 34 110 48M110 34 102 48M102 48 110 62M110 48 102 62M102 62 110 76M110 62 102 76"/>
    <path d="M18 20H110M18 26H110"/>
    <path d="M22 20 30 26M30 20 38 26M38 20 46 26M46 20 54 26M54 20 62 26M62 20 70 26M70 20 78 26M78 20 86 26M86 20 94 26M94 20 102 26M102 20 110 26"/>
  </g>

  <!-- PARs / moving heads na viga frontal (lentes piscam) -->
  <g fill="#312e81" stroke="#a5b4fc" stroke-width="0.5" stroke-opacity="0.6">
    <rect x="42.5" y="26" width="3" height="2.6" rx="0.6"/><rect x="50.5" y="26" width="3" height="2.6" rx="0.6"/><rect x="58.5" y="26" width="3" height="2.6" rx="0.6"/><rect x="66.5" y="26" width="3" height="2.6" rx="0.6"/><rect x="74.5" y="26" width="3" height="2.6" rx="0.6"/><rect x="82.5" y="26" width="3" height="2.6" rx="0.6"/>
  </g>
  <g fill="#fef9c3">
    <circle class="sdLens" cx="44" cy="29.2" r="1.15" style="animation-delay:-0.2s"/><circle class="sdLens" cx="52" cy="29.2" r="1.15" style="animation-delay:-1.4s"/><circle class="sdLens" cx="60" cy="29.2" r="1.15" style="animation-delay:-0.7s"/><circle class="sdLens" cx="68" cy="29.2" r="1.15" style="animation-delay:-1.9s"/><circle class="sdLens" cx="76" cy="29.2" r="1.15" style="animation-delay:-0.5s"/><circle class="sdLens" cx="84" cy="29.2" r="1.15" style="animation-delay:-1.1s"/>
  </g>

  <!-- Palco (deck em perspectiva) + escada central -->
  <path d="M14 76 H114 L120 88 H8 Z" fill="url(#sdDeckGrad)" stroke="#a5b4fc" stroke-width="0.8" stroke-opacity="0.45"/>
  <line x1="14" y1="76" x2="114" y2="76" stroke="#c4b5fd" stroke-width="1.3" stroke-opacity="0.85" stroke-linecap="round"/>
  <path d="M55 76 H73 L77 84 H51 Z" fill="#312e81" stroke="#a5b4fc" stroke-width="0.6" stroke-opacity="0.45"/>

  <!-- Poças de luz no chão (luzes cênicas batendo no deck) -->
  <ellipse class="sdPool sdPoolA" cx="51" cy="74" rx="13" ry="3.4" fill="url(#sdPoolP)"/>
  <ellipse class="sdPool sdPoolB" cx="77" cy="74" rx="13" ry="3.4" fill="url(#sdPoolK)"/>
  <ellipse class="sdPool sdPoolC" cx="64" cy="75" rx="11" ry="3" fill="url(#sdPoolP)"/>

  <!-- Banda (silhueta com rim-light contra o telão) -->
  <g fill="#08040f">
    <!-- guitarrista (esq) -->
    <circle cx="49" cy="65" r="2.2"/>
    <path d="M46.5 67 L51.5 67 L52.5 76 L45.5 76 Z"/>
    <ellipse cx="44.5" cy="71" rx="2.6" ry="1.7"/>
    <path d="M46 70 L52 66.5" stroke="#08040f" stroke-width="1.1" stroke-linecap="round"/>
    <!-- vocalista (centro) com microfone -->
    <circle cx="64" cy="62.5" r="2.4"/>
    <path d="M61 64.5 Q64 63.6 67 64.5 L68 76 L60 76 Z"/>
    <path d="M66 65 L69.4 60.5" stroke="#08040f" stroke-width="1.3" stroke-linecap="round"/>
    <circle cx="69.8" cy="59.7" r="1"/>
    <!-- baterista (dir) atrás do kit -->
    <circle cx="78" cy="63" r="2"/>
    <path d="M75.6 64.8 L80.4 64.8 L81 75 L75 75 Z"/>
    <ellipse cx="74" cy="73.5" rx="2.1" ry="1.5"/>
    <ellipse cx="80.5" cy="73.5" rx="2.1" ry="1.5"/>
    <path d="M83 70.5 L87 69.5" stroke="#08040f" stroke-width="0.8" stroke-linecap="round"/>
    <ellipse cx="86" cy="69.4" rx="2.2" ry="0.7"/>
  </g>
  <!-- rim-light nos ombros/cabeças (backlit pelo telão) -->
  <g fill="none" stroke="#f5d0fe" stroke-width="0.6" stroke-opacity="0.45" stroke-linecap="round">
    <path d="M46.9 65.6 A2.2 2.2 0 0 1 51.1 65.6"/>
    <path d="M61.7 63.1 A2.4 2.4 0 0 1 66.3 63.1"/>
    <path d="M76.1 63.6 A2 2 0 0 1 79.9 63.6"/>
  </g>

  <!-- Subwoofers / PA nas laterais do palco -->
  <g fill="#0b0712" stroke="#a5b4fc" stroke-width="0.5" stroke-opacity="0.5">
    <rect x="13" y="79" width="13" height="5" rx="1"/><rect x="13" y="84.4" width="13" height="5" rx="1"/>
    <rect x="102" y="79" width="13" height="5" rx="1"/><rect x="102" y="84.4" width="13" height="5" rx="1"/>
  </g>
  <g fill="#312e81">
    <circle cx="19.5" cy="81.5" r="1.5"/><circle cx="19.5" cy="86.9" r="1.5"/><circle cx="108.5" cy="81.5" r="1.5"/><circle cx="108.5" cy="86.9" r="1.5"/>
  </g>

  <!-- Plateia (silhueta + luzinhas de celular) -->
  <path d="M2 100 V94 Q9 90 15 94 Q22 90 28 94 Q35 91 41 94 Q48 90 54 94 Q61 91 67 94 Q74 90 80 94 Q87 91 93 94 Q100 90 106 94 Q113 91 119 94 Q124 91 126 94 V100 Z" fill="#06030b"/>
  <g stroke="#06030b" stroke-width="1.1" stroke-linecap="round">
    <path d="M24 93 V89"/><path d="M58 93 V88"/><path d="M96 93 V89"/>
  </g>
  <g fill="#fde68a">
    <circle cx="34" cy="91" r="0.8"/><circle cx="71" cy="90.4" r="0.8"/><circle cx="104" cy="91" r="0.8"/>
  </g>
</svg>`;

/** Glyph compacto (tier mid): mini palco (teto + torres + telão + luzes). */
const GLYPH_SVG = `
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M4 7 Q12 3 20 7" fill="none" stroke="#f9a8d4" stroke-width="1.2" stroke-linecap="round"/>
  <rect x="8" y="8" width="8" height="7" rx="1" fill="#ec4899"/>
  <g stroke="#f9a8d4" stroke-width="1.2" stroke-linecap="round">
    <path d="M5 7V16M19 7V16"/>
    <path d="M3 17H21"/>
  </g>
  <g fill="#fde68a"><circle cx="9.5" cy="9.4" r="0.9"/><circle cx="14.5" cy="9.4" r="0.9"/></g>
</svg>`;

export default function ShowDayLayer() {
  /* Feature "Hoje tem show" vive no menu Novas Features (brainstorm):
   * gated pelo flag `showDay`. Owners veem com o toggle ligado
   * (default on); não-owners recebem ALL_OFF → o marker não monta.
   * Mesmo padrão do MapPulses (`enabled` na dep do effect). */
  const { flags } = useBrainstormFlags();
  const enabled = flags.showDay;

  useEffect(() => {
    if (!enabled) return;

    let currentMap: MapboxMap | null = null;
    let marker: mapboxgl.Marker | null = null;
    let wrapEl: HTMLDivElement | null = null;
    let chipTextEls: HTMLElement[] = [];
    let chipSubEls: HTMLElement[] = [];
    let viewersEl: HTMLElement | null = null;
    let zoomHandler: (() => void) | null = null;
    let styleHandler: (() => void) | null = null;
    let lastTier: Tier | null = null;
    let lastPhase: ShowDayPhase = getShowDayPhase();

    const onHaloClick = () => {
      const tier = (wrapEl?.dataset.tier as Tier | undefined) ?? 'far';
      track('show_day_pin_clicked', {
        phase: getShowDayPhase(),
        tier: tier === 'hidden' ? 'far' : tier,
      });
      globeStore.openShowDay();
    };
    const onHaloEnter = () => {
      if (currentMap) currentMap.getCanvas().style.cursor = 'pointer';
    };
    const onHaloLeave = () => {
      if (currentMap) currentMap.getCanvas().style.cursor = '';
    };

    /* Atualiza chip/cores conforme a fase + countdown (tick 30s). */
    const applyPhase = () => {
      const phase = getShowDayPhase();
      if (phase !== lastPhase) {
        track('show_day_phase_changed', { from: lastPhase, to: phase });
        lastPhase = phase;
      }
      if (wrapEl) {
        wrapEl.dataset.phase = phase;
        const { text, sub } = chipContent(phase);
        chipTextEls.forEach((el) => { el.textContent = text; });
        chipSubEls.forEach((el) => {
          el.textContent = sub;
          el.style.display = sub ? '' : 'none';
        });
        if (viewersEl) {
          viewersEl.textContent =
            phase === 'live'
              ? `${formatViewers(getShowDayViewers())} assistindo`
              : '';
          viewersEl.style.display = phase === 'live' ? '' : 'none';
        }
      }
      if (currentMap?.getLayer(HALO_LAYER)) {
        currentMap.setPaintProperty(
          HALO_LAYER,
          'circle-color',
          PHASE_HALO_COLOR[phase],
        );
      }
    };

    const applyTier = (map: MapboxMap) => {
      const tier = tierFor(map.getZoom());
      if (tier === lastTier || !wrapEl) return;
      lastTier = tier;
      wrapEl.dataset.tier = tier;
    };

    /** Monta o DOM do marker (uma vez por attach). */
    const buildMarker = (map: MapboxMap) => {
      const wrap = document.createElement('div');
      wrap.className = styles.wrap;
      wrap.setAttribute('role', 'button');
      wrap.setAttribute('tabindex', '0');
      wrap.setAttribute(
        'aria-label',
        `Hoje tem show: ${SHOW_DAY.venue}, ${SHOW_DAY.city}`,
      );
      wrap.dataset.phase = getShowDayPhase();
      wrap.dataset.tier = tierFor(map.getZoom());
      lastTier = tierFor(map.getZoom());

      /* Anéis de pulso (mid + near). */
      const pulseA = document.createElement('span');
      pulseA.className = `${styles.pulse} ${styles.pulseA}`;
      const pulseB = document.createElement('span');
      pulseB.className = `${styles.pulse} ${styles.pulseB}`;
      wrap.appendChild(pulseA);
      wrap.appendChild(pulseB);

      const makeChip = () => {
        const chip = document.createElement('span');
        chip.className = styles.chip;
        const dot = document.createElement('span');
        dot.className = styles.chipDot;
        const text = document.createElement('span');
        text.className = styles.chipText;
        const sub = document.createElement('span');
        sub.className = styles.chipSub;
        chip.appendChild(dot);
        chip.appendChild(text);
        chip.appendChild(sub);
        chipTextEls.push(text);
        chipSubEls.push(sub);
        return chip;
      };

      /* Tier MID — glyph + chip. */
      const mid = document.createElement('div');
      mid.className = styles.mid;
      const glyph = document.createElement('span');
      glyph.className = styles.glyph;
      glyph.innerHTML = GLYPH_SVG;
      mid.appendChild(glyph);
      mid.appendChild(makeChip());
      wrap.appendChild(mid);

      /* Tier NEAR — feixes + arena + chip + viewers. */
      const near = document.createElement('div');
      near.className = styles.near;
      const beams = document.createElement('div');
      beams.className = styles.beams;
      (['beamL2', 'beamL', 'beamC', 'beamR', 'beamR2'] as const).forEach((k) => {
        const beam = document.createElement('span');
        beam.className = `${styles.beam} ${styles[k]}`;
        beams.appendChild(beam);
      });
      near.appendChild(beams);
      const arena = document.createElement('span');
      arena.className = styles.arena;
      arena.innerHTML = ARENA_SVG;
      near.appendChild(arena);
      near.appendChild(makeChip());
      const viewers = document.createElement('span');
      viewers.className = styles.viewersChip;
      near.appendChild(viewers);
      viewersEl = viewers;
      wrap.appendChild(near);

      /* Click/teclado → painel. stopPropagation evita double-fire
       * com o click da layer nativa por baixo. */
      const open = (e: Event) => {
        e.stopPropagation();
        const tier = (wrap.dataset.tier as Tier) ?? 'mid';
        track('show_day_pin_clicked', {
          phase: getShowDayPhase(),
          tier: tier === 'hidden' ? 'far' : tier,
        });
        globeStore.openShowDay();
      };
      wrap.addEventListener('click', open);
      wrap.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') open(e);
      });

      wrapEl = wrap;
      marker = new mapboxgl.Marker({ element: wrap, anchor: 'bottom' })
        .setLngLat([SHOW_DAY.lng, SHOW_DAY.lat])
        .addTo(map);
    };

    /** Source + circle layers nativas (tier longe). Idempotente —
     *  guard pelo getSource; re-roda no style.load (style swap). */
    const ensureLayers = (map: MapboxMap) => {
      if (map.getSource(SOURCE_ID)) return;
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [SHOW_DAY.lng, SHOW_DAY.lat],
              },
              properties: {},
            },
          ],
        },
      });
      map.addLayer({
        id: HALO_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-color': PHASE_HALO_COLOR[getShowDayPhase()],
          'circle-blur': 1.1,
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            1, 8, 4, 14, 8, 22, 10, 30, 12, 36,
          ],
          'circle-opacity': [
            'interpolate', ['linear'], ['zoom'],
            1, 0.55, 9.5, 0.45, 10.5, 0.18,
          ],
        },
      });
      map.addLayer({
        id: CORE_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-color': '#fff1f8',
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            1, 2.5, 4, 3.5,
          ],
          // Handoff pro chip DOM: o core some quando o tier mid entra.
          'circle-opacity': [
            'interpolate', ['linear'], ['zoom'],
            3.5, 1, 4.5, 0,
          ],
        },
      });
      map.on('click', HALO_LAYER, onHaloClick);
      map.on('mouseenter', HALO_LAYER, onHaloEnter);
      map.on('mouseleave', HALO_LAYER, onHaloLeave);
    };

    const detach = () => {
      if (marker) {
        try { marker.remove(); } catch { /* mapa já destruído */ }
        marker = null;
      }
      wrapEl = null;
      chipTextEls = [];
      chipSubEls = [];
      viewersEl = null;
      lastTier = null;
      if (currentMap) {
        try {
          if (zoomHandler) currentMap.off('zoom', zoomHandler);
          if (styleHandler) currentMap.off('style.load', styleHandler);
          currentMap.off('click', HALO_LAYER, onHaloClick);
          currentMap.off('mouseenter', HALO_LAYER, onHaloEnter);
          currentMap.off('mouseleave', HALO_LAYER, onHaloLeave);
        } catch { /* mapa já destruído — map.remove() limpa layers */ }
      }
      currentMap = null;
      zoomHandler = null;
      styleHandler = null;
    };

    const attach = (mapUnknown: unknown | null) => {
      if (!mapUnknown) {
        detach();
        return;
      }
      const map = mapUnknown as MapboxMap;
      detach();
      currentMap = map;

      const setup = () => {
        ensureLayers(map);
        if (!marker) buildMarker(map);
        applyPhase();
        applyTier(map);
      };
      if (map.isStyleLoaded()) setup();
      else map.once('style.load', setup);
      // Style swap futuro re-cria as layers (marker DOM sobrevive).
      styleHandler = () => ensureLayers(map);
      map.on('style.load', styleHandler);

      zoomHandler = () => applyTier(map);
      map.on('zoom', zoomHandler);
    };

    const unsubscribe = globeStore.subscribeMapInstance(attach);

    /* Tick de fase/countdown — granularidade de minuto basta pro
     * chip; 30s garante a virada de fase com ≤30s de atraso. */
    const phaseTimer = setInterval(applyPhase, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') applyPhase();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      unsubscribe();
      clearInterval(phaseTimer);
      document.removeEventListener('visibilitychange', onVisible);
      detach();
    };
  }, [enabled]);

  return null;
}
