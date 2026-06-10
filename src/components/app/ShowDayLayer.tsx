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

/** Arena simbólica (tier near): arco de palco + 3 fileiras de
 *  pontos-plateia + baseline. Gradiente com id fixo é seguro —
 *  só existe UMA instância deste marker no app. */
const ARENA_SVG = `
<svg viewBox="0 0 120 84" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="sdStageGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a855f7"/>
      <stop offset="0.55" stop-color="#d946ef"/>
      <stop offset="1" stop-color="#ec4899"/>
    </linearGradient>
  </defs>
  <path d="M28 38a32 18 0 0 1 64 0l-6 4a26 14 0 0 0-52 0z" fill="url(#sdStageGrad)" opacity="0.95"/>
  <ellipse cx="60" cy="42" rx="26" ry="6.5" stroke="url(#sdStageGrad)" stroke-width="2" opacity="0.8"/>
  <g fill="#f9a8d4" opacity="0.85">
    <circle cx="34" cy="56" r="2"/><circle cx="47" cy="58" r="2"/><circle cx="60" cy="59" r="2"/><circle cx="73" cy="58" r="2"/><circle cx="86" cy="56" r="2"/>
  </g>
  <g fill="#e879f9" opacity="0.6">
    <circle cx="26" cy="64" r="1.8"/><circle cx="38" cy="66.5" r="1.8"/><circle cx="49" cy="68" r="1.8"/><circle cx="60" cy="68.6" r="1.8"/><circle cx="71" cy="68" r="1.8"/><circle cx="82" cy="66.5" r="1.8"/><circle cx="94" cy="64" r="1.8"/>
  </g>
  <g fill="#c084fc" opacity="0.4">
    <circle cx="18" cy="73" r="1.5"/><circle cx="29" cy="75" r="1.5"/><circle cx="40" cy="76.5" r="1.5"/><circle cx="50" cy="77.4" r="1.5"/><circle cx="60" cy="77.8" r="1.5"/><circle cx="70" cy="77.4" r="1.5"/><circle cx="80" cy="76.5" r="1.5"/><circle cx="91" cy="75" r="1.5"/><circle cx="102" cy="73" r="1.5"/>
  </g>
  <line x1="14" y1="82" x2="106" y2="82" stroke="rgba(236,72,153,0.5)" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

/** Glyph compacto (tier mid): mini arco de palco. */
const GLYPH_SVG = `
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M5 13a7 5 0 0 1 14 0l-2 1.4a5 3.4 0 0 0-10 0z" fill="#ec4899"/>
  <circle cx="7" cy="18" r="1.2" fill="#f9a8d4"/>
  <circle cx="12" cy="19.2" r="1.2" fill="#f9a8d4"/>
  <circle cx="17" cy="18" r="1.2" fill="#f9a8d4"/>
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
      (['beamL', 'beamC', 'beamR'] as const).forEach((k) => {
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
