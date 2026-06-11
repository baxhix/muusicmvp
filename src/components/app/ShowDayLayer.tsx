'use client';

import { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Map as MapboxMap } from 'mapbox-gl';
import { globeStore } from '@/lib/globeStore';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import { track } from '@/lib/analytics';
import { SHOW_DAY, getShowDayPhase, type ShowDayPhase } from '@/lib/showDay';
import { SHOW_DAY_FANS } from '@/data/showDayFeed';
import styles from './ShowDayLayer.module.css';

/* ============================================================
 * HOJE TEM SHOW — camada visual do marker da Fire Arena.
 *
 * Híbrido nativo + DOM, seguindo a receita do MapPulses
 * (subscribeMapInstance, render null, cleanup completo — ZERO
 * mudanças no Globe.tsx):
 *
 *   • 2 circle layers nativas (halo blur + core) — glow do ponto,
 *     visível em todos os zooms, escala via interpolate.
 *   • 1 DOM marker — 3 spots de luz (sempre, escalando por zoom) +
 *     badge cujo conteúdo muda por faixa de zoom + palco simbólico
 *     (arena) a partir de z8.
 *
 * Faixas de zoom (badge + palco):
 *   z < 2.5    nada (só nativo)
 *   2.5–6      3 spots + badge "Show de hoje!"
 *   6–9.2      3 spots + badge "Show de hoje às 23h00! / Salvador - BA"
 *   ≥ 8        + palco (arena) aparece
 *   ≥ 9.2      badge vira box (foto + título + CTA "Entrar no chat")
 *
 * Spots: SEMPRE os 3 feixes (L/C/R) quando visível, varrendo rápido,
 * altura escala por zoom (--sdBeamH). Badges SEM borda e SEM dot.
 *
 * Performance: zero JS-per-frame. Animação é CSS keyframe
 * (transform/opacity); o JS é um interval de 30s (fase) + um zoom
 * handler O(1) que escreve data-badge/data-stage/--sdBeamH.
 * ============================================================ */

const SOURCE_ID = 'show-day';
const HALO_LAYER = 'show-day-halo';
const CORE_LAYER = 'show-day-core';

/** Limiares de zoom (travados com o produto). */
const SPOTS_MIN = 2.5; // a partir daqui os 3 spots + badge aparecem
const BADGE_CITY_MIN = 6; // badge passa a mostrar hora + cidade
const STAGE_MIN = 8; // palco (arena) aparece
const BADGE_BOX_MIN = 9.2; // badge vira box (foto + título + CTA)

/** Foto do box (z ≥ 9.2). */
const SHOW_PHOTO = '/show-day/show-1.jpg';

/** 3 rostos pra empilhar no CTA "Entrar no chat" (mesmos fãs do
 *  chat do show) — reforça o "tem gente aqui agora". */
const CTA_FACES = SHOW_DAY_FANS.slice(0, 3).map((f) => f.avatarUrl);

type BadgeLevel = 'none' | 'simple' | 'city' | 'box';

const PHASE_HALO_COLOR: Record<ShowDayPhase, string> = {
  announced: '#ec4899',
  live: '#f43f5e',
  ended: 'rgba(148, 163, 184, 0.8)',
};

function badgeLevelFor(zoom: number): BadgeLevel {
  if (zoom < SPOTS_MIN) return 'none';
  if (zoom < BADGE_CITY_MIN) return 'simple';
  if (zoom < BADGE_BOX_MIN) return 'city';
  return 'box';
}

function stageVisibleFor(zoom: number): boolean {
  return zoom >= STAGE_MIN;
}

/** Tier coarse só pro parâmetro de analytics. */
function tierForAnalytics(zoom: number): 'far' | 'mid' | 'near' {
  if (zoom < BADGE_CITY_MIN) return 'far';
  if (zoom < BADGE_BOX_MIN) return 'mid';
  return 'near';
}

/* Altura (px) dos feixes de luz por zoom — metade da altura anterior
 * pra um cue mais discreto:
 *   z2.5→27 · z4→48 · z6→53 · z7.5→58 · z9.2→53 · z12→112.
 * Interpolação linear por trechos; clamp nas pontas. O valor é
 * escrito numa var CSS (--sdBeamH) e a `height` dos feixes a usa,
 * então os spots crescem/encolhem suavemente conforme o zoom. */
const BEAM_HEIGHT_STOPS: ReadonlyArray<readonly [number, number]> = [
  [2.5, 27],
  [4, 48],
  [6, 53],
  [7.5, 58],
  [9.2, 53],
  [12, 112],
];

function beamHeightFor(zoom: number): number {
  const stops = BEAM_HEIGHT_STOPS;
  if (zoom <= stops[0][0]) return stops[0][1];
  const last = stops[stops.length - 1];
  if (zoom >= last[0]) return last[1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [z0, h0] = stops[i];
    const [z1, h1] = stops[i + 1];
    if (zoom >= z0 && zoom <= z1) {
      const t = (zoom - z0) / (z1 - z0);
      return Math.round(h0 + (h1 - h0) * t);
    }
  }
  return last[1];
}

/** Palco de festival simbólico (z ≥ 8): colunas sólidas, telão de LED
 *  central, line-arrays pendurados, PARs na viga (lentes piscam) e o
 *  palco com escada + plateia. Estrutura em índigo claro pra ler sobre
 *  o mapa escuro. Ids de gradiente fixos são seguros — só existe UMA
 *  instância deste marker no app. */
const ARENA_SVG = `
<svg viewBox="0 0 128 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="sdSky" cx="0.5" cy="0.42" r="0.72">
      <stop offset="0" stop-color="#000000" stop-opacity="0.62"/>
      <stop offset="0.55" stop-color="#000000" stop-opacity="0.4"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sdScreen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fce7f3"/>
      <stop offset="0.32" stop-color="#f472b6"/>
      <stop offset="0.68" stop-color="#c026d3"/>
      <stop offset="1" stop-color="#7c3aed"/>
    </linearGradient>
    <linearGradient id="sdDeck" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#26113a"/>
      <stop offset="1" stop-color="#090413"/>
    </linearGradient>
    <radialGradient id="sdGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ec4899" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#ec4899" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sdRayP" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f5d0fe" stop-opacity="0.9"/>
      <stop offset="0.55" stop-color="#d946ef" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#a855f7" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="sdRayK" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fbcfe8" stop-opacity="0.9"/>
      <stop offset="0.55" stop-color="#f472b6" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#ec4899" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="sdPoolP" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#a855f7" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#a855f7" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sdPoolK" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ec4899" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#ec4899" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sdHaze" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c084fc" stop-opacity="0"/>
      <stop offset="1" stop-color="#7c3aed" stop-opacity="0.2"/>
    </linearGradient>
  </defs>
  <style>
    .sdRay{transform-box:fill-box;transform-origin:50% 0;mix-blend-mode:screen;animation:sdsvgRay 4.6s ease-in-out infinite}
    .sdRayB{animation-duration:5.4s;animation-delay:-1.7s}
    .sdRayC{animation-duration:5s;animation-delay:-2.8s}
    .sdRayD{animation-duration:5.8s;animation-delay:-.9s}
    .sdRayE{animation-duration:4.9s;animation-delay:-3.4s}
    .sdPool{transform-box:fill-box;transform-origin:center;mix-blend-mode:screen;animation:sdsvgPool 3.2s ease-in-out infinite}
    .sdPoolB{animation-duration:3.8s;animation-delay:-1.2s}
    .sdPoolC{animation-duration:4.4s;animation-delay:-.6s}
    .sdLens{animation:sdsvgLens 2.2s ease-in-out infinite}
    .sdStar{animation:sdsvgStar 2.6s ease-in-out infinite}
    @keyframes sdsvgRay{0%,100%{transform:rotate(-7deg);opacity:.55}50%{transform:rotate(7deg);opacity:.95}}
    @keyframes sdsvgPool{0%,100%{opacity:.5;transform:scaleX(1)}50%{opacity:.85;transform:scaleX(1.14)}}
    @keyframes sdsvgLens{0%,100%{opacity:.45}50%{opacity:1}}
    @keyframes sdsvgStar{0%,100%{opacity:.2}50%{opacity:1}}
    @media (max-width:768px){.sdRay,.sdPool,.sdLens,.sdStar{animation:none}}
    @media (prefers-reduced-motion:reduce){.sdRay,.sdPool,.sdLens,.sdStar{animation:none}}
  </style>

  <!-- Fundo escuro de arena (mood roxo profundo) -->
  <ellipse cx="64" cy="39" rx="63" ry="49" fill="url(#sdSky)"/>
  <!-- Glow rosa atrás do telão -->
  <ellipse cx="64" cy="43" rx="41" ry="29" fill="url(#sdGlow)" opacity="0.6"/>

  <!-- Treliça do teto (arco) -->
  <g stroke="#6d4aa8" stroke-width="0.7" stroke-opacity="0.7" stroke-linecap="round" fill="none">
    <path d="M16 18.5 Q64 12.5 112 18.5"/>
    <path d="M16 23.5 Q64 17.7 112 23.5"/>
    <path d="M18 23.2 L24 18.9 L30 22.9 L36 18.7 L42 22.7 L48 18.5 L54 22.6 L60 18.4 L68 18.4 L74 22.6 L80 18.5 L86 22.7 L92 18.7 L98 22.9 L104 18.9 L110 23.2"/>
  </g>
  <path d="M16 18.3 Q64 12.3 112 18.3" stroke="#d8b4fe" stroke-width="0.8" stroke-opacity="0.55" fill="none"/>

  <!-- Colunas treliçadas -->
  <g stroke="#6d4aa8" stroke-width="0.7" stroke-opacity="0.65" stroke-linecap="round" fill="none">
    <line x1="19.5" y1="23" x2="19.5" y2="78"/>
    <line x1="25.5" y1="23" x2="25.5" y2="78"/>
    <path d="M19.5 27 L25.5 31 M25.5 35 L19.5 39 M19.5 43 L25.5 47 M25.5 51 L19.5 55 M19.5 59 L25.5 63 M25.5 67 L19.5 71"/>
    <line x1="19.5" y1="31" x2="25.5" y2="31"/><line x1="19.5" y1="43" x2="25.5" y2="43"/><line x1="19.5" y1="55" x2="25.5" y2="55"/><line x1="19.5" y1="67" x2="25.5" y2="67"/>
    <line x1="102.5" y1="23" x2="102.5" y2="78"/>
    <line x1="108.5" y1="23" x2="108.5" y2="78"/>
    <path d="M108.5 27 L102.5 31 M102.5 35 L108.5 39 M108.5 43 L102.5 47 M102.5 51 L108.5 55 M108.5 59 L102.5 63 M102.5 67 L108.5 71"/>
    <line x1="102.5" y1="31" x2="108.5" y2="31"/><line x1="102.5" y1="43" x2="108.5" y2="43"/><line x1="102.5" y1="55" x2="108.5" y2="55"/><line x1="102.5" y1="67" x2="108.5" y2="67"/>
  </g>
  <!-- Tiras de pixel LED nas colunas (glow rosa) -->
  <g class="sdLens" fill="#f0abfc">
    <rect x="21.6" y="30" width="2" height="3" rx="0.6" style="animation-delay:-0.3s"/>
    <rect x="21.6" y="38" width="2" height="3" rx="0.6" style="animation-delay:-1.1s"/>
    <rect x="21.6" y="46" width="2" height="3" rx="0.6" style="animation-delay:-0.7s"/>
    <rect x="21.6" y="54" width="2" height="3" rx="0.6" style="animation-delay:-1.6s"/>
    <rect x="21.6" y="62" width="2" height="3" rx="0.6" style="animation-delay:-0.5s"/>
    <rect x="104.4" y="30" width="2" height="3" rx="0.6" style="animation-delay:-0.9s"/>
    <rect x="104.4" y="38" width="2" height="3" rx="0.6" style="animation-delay:-0.2s"/>
    <rect x="104.4" y="46" width="2" height="3" rx="0.6" style="animation-delay:-1.3s"/>
    <rect x="104.4" y="54" width="2" height="3" rx="0.6" style="animation-delay:-0.6s"/>
    <rect x="104.4" y="62" width="2" height="3" rx="0.6" style="animation-delay:-1.8s"/>
  </g>

  <!-- Line-arrays pendurados (flanqueando o telão) -->
  <g fill="url(#sdDeck)" stroke="#6d4aa8" stroke-width="0.6" stroke-opacity="0.55">
    <line x1="34" y1="24" x2="34" y2="29" stroke="#8b5cf6" stroke-width="0.9" stroke-opacity="0.6"/>
    <rect x="31" y="29" width="6" height="3.4" rx="1"/><rect x="31.3" y="33" width="5.4" height="3.4" rx="1"/><rect x="31.6" y="37" width="4.8" height="3.4" rx="1"/><rect x="31.9" y="41" width="4.2" height="3.4" rx="1"/>
    <line x1="94" y1="24" x2="94" y2="29" stroke="#8b5cf6" stroke-width="0.9" stroke-opacity="0.6"/>
    <rect x="91" y="29" width="6" height="3.4" rx="1"/><rect x="91.3" y="33" width="5.4" height="3.4" rx="1"/><rect x="91.6" y="37" width="4.8" height="3.4" rx="1"/><rect x="91.9" y="41" width="4.2" height="3.4" rx="1"/>
  </g>

  <!-- Telão de LED (gradiente rosa→roxo, sem barras) -->
  <rect x="40" y="29.5" width="48" height="29" rx="2.5" fill="url(#sdScreen)"/>
  <g stroke="#fdf4ff" stroke-opacity="0.12" stroke-width="0.6"><line x1="42" y1="36" x2="86" y2="36"/><line x1="42" y1="58" x2="86" y2="58"/></g>
  <rect x="40" y="29.5" width="48" height="29" rx="2.5" fill="none" stroke="#fbcfe8" stroke-width="0.9" stroke-opacity="0.6"/>

  <!-- Viga frontal + moving heads (lentes piscam) -->
  <rect x="18" y="22.5" width="92" height="3.2" rx="1.2" fill="url(#sdDeck)" stroke="#6d4aa8" stroke-width="0.6" stroke-opacity="0.5"/>
  <g fill="#1a0f2e" stroke="#6d4aa8" stroke-width="0.45" stroke-opacity="0.6">
    <rect x="44" y="26" width="3" height="2.6" rx="0.6"/><rect x="52" y="26" width="3" height="2.6" rx="0.6"/><rect x="60" y="26" width="3" height="2.6" rx="0.6"/><rect x="68" y="26" width="3" height="2.6" rx="0.6"/><rect x="76" y="26" width="3" height="2.6" rx="0.6"/><rect x="84" y="26" width="3" height="2.6" rx="0.6"/>
  </g>
  <g fill="#fdf4ff">
    <circle class="sdLens" cx="45.5" cy="29" r="1.1" style="animation-delay:-0.2s"/><circle class="sdLens" cx="53.5" cy="29" r="1.1" style="animation-delay:-1.4s"/><circle class="sdLens" cx="61.5" cy="29" r="1.1" style="animation-delay:-0.7s"/><circle class="sdLens" cx="69.5" cy="29" r="1.1" style="animation-delay:-1.9s"/><circle class="sdLens" cx="77.5" cy="29" r="1.1" style="animation-delay:-0.5s"/><circle class="sdLens" cx="85.5" cy="29" r="1.1" style="animation-delay:-1.1s"/>
  </g>

  <!-- Palco (deck em perspectiva) + reflexo + passarela -->
  <path d="M14 76 H114 L120 90 H8 Z" fill="url(#sdDeck)" stroke="#6d4aa8" stroke-width="0.7" stroke-opacity="0.4"/>
  <path d="M40 76 H88 L92 83 H36 Z" fill="url(#sdScreen)" opacity="0.12"/>
  <line x1="14" y1="76" x2="114" y2="76" stroke="#e9d5ff" stroke-width="1.2" stroke-opacity="0.8" stroke-linecap="round"/>
  <path d="M56 76 H72 L76 84 H52 Z" fill="#1a0f2e" stroke="#6d4aa8" stroke-width="0.5" stroke-opacity="0.5"/>

  <!-- Feixes volumétricos varrendo (na frente do telão, mix screen) -->
  <g>
    <polygon class="sdRay" points="50,28 40,88 60,88" fill="url(#sdRayP)"/>
    <polygon class="sdRay sdRayB" points="64,27 52,90 76,90" fill="url(#sdRayK)"/>
    <polygon class="sdRay sdRayC" points="78,28 68,88 88,88" fill="url(#sdRayP)"/>
    <polygon class="sdRay sdRayD" points="42,29 34,84 50,84" fill="url(#sdRayK)"/>
    <polygon class="sdRay sdRayE" points="87,29 78,84 96,84" fill="url(#sdRayP)"/>
  </g>

  <!-- Poças de luz no chão -->
  <ellipse class="sdPool" cx="50" cy="74" rx="13" ry="3.3" fill="url(#sdPoolP)"/>
  <ellipse class="sdPool sdPoolB" cx="78" cy="74" rx="13" ry="3.3" fill="url(#sdPoolK)"/>
  <ellipse class="sdPool sdPoolC" cx="64" cy="75" rx="11" ry="3" fill="url(#sdPoolP)"/>

  <!-- Névoa / haze sobre o palco -->
  <rect x="8" y="64" width="112" height="22" fill="url(#sdHaze)" style="mix-blend-mode:screen" opacity="0.7"/>

  <!-- PA / subwoofers laterais -->
  <g fill="#0b0712" stroke="#6d4aa8" stroke-width="0.45" stroke-opacity="0.5">
    <rect x="13" y="79" width="12" height="5" rx="1"/><rect x="13" y="84.4" width="12" height="5" rx="1"/>
    <rect x="103" y="79" width="12" height="5" rx="1"/><rect x="103" y="84.4" width="12" height="5" rx="1"/>
  </g>
  <g fill="#7c3aed">
    <circle cx="19" cy="81.5" r="1.4"/><circle cx="19" cy="86.9" r="1.4"/><circle cx="109" cy="81.5" r="1.4"/><circle cx="109" cy="86.9" r="1.4"/>
  </g>

  <!-- Plateia: silhueta + mar de luzes (piscando) -->
  <path d="M2 100 V93 Q9 89 15 93 Q22 89 28 93 Q35 90 41 93 Q48 89 54 93 Q61 90 67 93 Q74 89 80 93 Q87 90 93 93 Q100 89 106 93 Q113 90 119 93 Q124 90 126 93 V100 Z" fill="#05020a"/>
  <g class="sdStar" fill="#fde68a">
    <circle cx="14" cy="91" r="0.7" style="animation-delay:-0.2s"/>
    <circle cx="24" cy="89.6" r="0.7" style="animation-delay:-1.3s"/>
    <circle cx="33" cy="91.4" r="0.7" style="animation-delay:-0.6s"/>
    <circle cx="44" cy="89.2" r="0.7" style="animation-delay:-1.8s"/>
    <circle cx="58" cy="90.6" r="0.7" style="animation-delay:-0.9s"/>
    <circle cx="71" cy="89.4" r="0.7" style="animation-delay:-2.1s"/>
    <circle cx="84" cy="91" r="0.7" style="animation-delay:-0.4s"/>
    <circle cx="96" cy="89.6" r="0.7" style="animation-delay:-1.5s"/>
    <circle cx="107" cy="91.2" r="0.7" style="animation-delay:-0.8s"/>
    <circle cx="116" cy="90" r="0.7" style="animation-delay:-2.3s"/>
  </g>
  <g class="sdStar" fill="#f9a8d4">
    <circle cx="19" cy="90.4" r="0.6" style="animation-delay:-1s"/>
    <circle cx="39" cy="90.8" r="0.6" style="animation-delay:-0.3s"/>
    <circle cx="64" cy="89.8" r="0.6" style="animation-delay:-1.7s"/>
    <circle cx="90" cy="90.6" r="0.6" style="animation-delay:-0.7s"/>
    <circle cx="112" cy="90.8" r="0.6" style="animation-delay:-2s"/>
  </g>
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
    let zoomHandler: (() => void) | null = null;
    let styleHandler: (() => void) | null = null;
    let lastBadge: BadgeLevel | null = null;
    let lastStage: 'on' | 'off' | null = null;
    let lastPhase: ShowDayPhase = getShowDayPhase();

    const openPanel = () => {
      const z = currentMap?.getZoom() ?? BADGE_CITY_MIN;
      track('show_day_pin_clicked', {
        phase: getShowDayPhase(),
        tier: tierForAnalytics(z),
      });
      globeStore.openShowDay();
    };

    const onHaloClick = () => openPanel();
    const onHaloEnter = () => {
      if (currentMap) currentMap.getCanvas().style.cursor = 'pointer';
    };
    const onHaloLeave = () => {
      if (currentMap) currentMap.getCanvas().style.cursor = '';
    };

    /* Fase: cor do halo nativo + data-phase (spots/arena reagem). */
    const applyPhase = () => {
      const phase = getShowDayPhase();
      if (phase !== lastPhase) {
        track('show_day_phase_changed', { from: lastPhase, to: phase });
        lastPhase = phase;
      }
      if (wrapEl) wrapEl.dataset.phase = phase;
      if (currentMap?.getLayer(HALO_LAYER)) {
        currentMap.setPaintProperty(
          HALO_LAYER,
          'circle-color',
          PHASE_HALO_COLOR[phase],
        );
      }
    };

    /* Zoom: badge level + palco + altura dos feixes. Roda a cada
     * evento de zoom — barato (escreve data-attrs / uma var num
     * subtree 0×0; nenhum reflow de página). */
    const applyZoom = (map: MapboxMap) => {
      if (!wrapEl) return;
      const z = map.getZoom();
      const badge = badgeLevelFor(z);
      if (badge !== lastBadge) {
        wrapEl.dataset.badge = badge;
        lastBadge = badge;
      }
      const stage = stageVisibleFor(z) ? 'on' : 'off';
      if (stage !== lastStage) {
        wrapEl.dataset.stage = stage;
        lastStage = stage;
      }
      wrapEl.style.setProperty('--sdBeamH', `${beamHeightFor(z)}px`);
    };

    /** Monta o DOM do marker (uma vez por attach). */
    const buildMarker = (map: MapboxMap) => {
      const z = map.getZoom();
      const wrap = document.createElement('div');
      wrap.className = styles.wrap;
      wrap.setAttribute('role', 'button');
      wrap.setAttribute('tabindex', '0');
      wrap.setAttribute(
        'aria-label',
        `Hoje tem show: ${SHOW_DAY.venue}, ${SHOW_DAY.city}`,
      );
      wrap.dataset.phase = getShowDayPhase();
      wrap.dataset.badge = badgeLevelFor(z);
      wrap.dataset.stage = stageVisibleFor(z) ? 'on' : 'off';
      lastBadge = badgeLevelFor(z);
      lastStage = stageVisibleFor(z) ? 'on' : 'off';
      wrap.style.setProperty('--sdBeamH', `${beamHeightFor(z)}px`);

      /* Anéis de pulso no ponto. */
      const pulseA = document.createElement('span');
      pulseA.className = `${styles.pulse} ${styles.pulseA}`;
      const pulseB = document.createElement('span');
      pulseB.className = `${styles.pulse} ${styles.pulseB}`;
      wrap.appendChild(pulseA);
      wrap.appendChild(pulseB);

      /* Spots de luz — SEMPRE os 3 feixes (L/C/R) quando visível,
       * varrendo rápido; altura escala com o zoom (--sdBeamH). */
      const spots = document.createElement('div');
      spots.className = styles.spots;
      (['beamL', 'beamC', 'beamR'] as const).forEach((k) => {
        const beam = document.createElement('span');
        beam.className = `${styles.beam} ${styles[k]}`;
        spots.appendChild(beam);
      });
      wrap.appendChild(spots);

      /* Conteúdo (badges + palco), ancorado na base do marker. */
      const content = document.createElement('div');
      content.className = styles.content;

      // Badge "simple" (2.5–6): "Show de hoje!"
      const badgeSimple = document.createElement('span');
      badgeSimple.className = styles.badgeSimple;
      badgeSimple.textContent = 'Hoje tem show!';
      content.appendChild(badgeSimple);

      // Badge "city" (6–9.2): hora + cidade
      const badgeCity = document.createElement('div');
      badgeCity.className = styles.badgeCity;
      const cityTitle = document.createElement('span');
      cityTitle.className = styles.badgeCityTitle;
      cityTitle.textContent = 'Hoje tem show às 23h00!';
      badgeCity.appendChild(cityTitle);
      content.appendChild(badgeCity);

      // Badge "box" (≥9.2): card vertical — foto full-bleed no topo +
      // corpo (título "Show Ana Castela" + "Festa do Peão" regular/cinza
      // na linha de baixo) + CTA "Entrar no chat".
      const badgeBox = document.createElement('div');
      badgeBox.className = styles.badgeBox;
      const photo = document.createElement('img');
      photo.className = styles.badgeBoxPhoto;
      photo.src = SHOW_PHOTO;
      photo.alt = '';
      photo.loading = 'lazy';
      const boxBody = document.createElement('div');
      boxBody.className = styles.badgeBoxBody;
      const boxTitle = document.createElement('span');
      boxTitle.className = styles.badgeBoxTitle;
      boxTitle.textContent = 'Show Ana Castela';
      const boxSub = document.createElement('span');
      boxSub.className = styles.badgeBoxSub;
      boxSub.textContent = 'Festa do Peão';
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = styles.badgeCta;
      // 4 miniaturas sobrepostas antes da palavra "Entrar" (estilo
      //  pilha de avatares do chat) + label.
      const ctaAvatars = document.createElement('span');
      ctaAvatars.className = styles.ctaAvatars;
      CTA_FACES.forEach((url) => {
        const face = document.createElement('img');
        face.className = styles.ctaAvatar;
        face.src = url;
        face.alt = '';
        face.loading = 'lazy';
        ctaAvatars.appendChild(face);
      });
      const ctaLabel = document.createElement('span');
      ctaLabel.className = styles.ctaLabel;
      ctaLabel.textContent = 'Entrar no chat';
      cta.appendChild(ctaAvatars);
      cta.appendChild(ctaLabel);
      cta.addEventListener('click', (e) => {
        e.stopPropagation();
        openPanel();
      });
      boxBody.appendChild(boxTitle);
      boxBody.appendChild(boxSub);
      boxBody.appendChild(cta);
      badgeBox.appendChild(photo);
      badgeBox.appendChild(boxBody);
      content.appendChild(badgeBox);

      // Palco (arena) — visível a partir de z8 (data-stage='on').
      const arena = document.createElement('span');
      arena.className = styles.arena;
      arena.innerHTML = ARENA_SVG;
      content.appendChild(arena);

      wrap.appendChild(content);

      /* Click/teclado → painel. stopPropagation evita double-fire
       * com o click da layer nativa por baixo. */
      const open = (e: Event) => {
        e.stopPropagation();
        openPanel();
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

    /** Source + circle layers nativas (glow do ponto). Idempotente —
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
          // Handoff pro badge DOM: o core some quando o badge entra.
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
      lastBadge = null;
      lastStage = null;
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
        applyZoom(map);
      };
      if (map.isStyleLoaded()) setup();
      else map.once('style.load', setup);
      // Style swap futuro re-cria as layers (marker DOM sobrevive).
      styleHandler = () => ensureLayers(map);
      map.on('style.load', styleHandler);

      zoomHandler = () => applyZoom(map);
      map.on('zoom', zoomHandler);
    };

    const unsubscribe = globeStore.subscribeMapInstance(attach);

    /* Tick de fase — 30s garante a virada de fase com ≤30s de atraso. */
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
