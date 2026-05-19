'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { globeStore } from '@/lib/globeStore';
import { loadGlobeCamera, saveGlobeCamera } from '@/lib/globeCamera';
import { track } from '@/lib/analytics';
import { getSocket } from '@/lib/socket/client';
import styles from './Globe.module.css';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// ─────────────────────────────────────────────────────────────────────────────

export default function Globe() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    mapboxgl.accessToken = TOKEN;

    // Camera state persistence — restore the user's last view so
    // navigating between /app routes (which unmounts Globe on
    // mobile) feels seamless. First visit + corrupted storage fall
    // through to the globe-view defaults.
    const persisted = loadGlobeCamera();
    const initialZoom = persisted?.zoom ?? 1.8;
    const initialCenter: [number, number] = persisted
      ? [persisted.lng, persisted.lat]
      : [15, 20];
    const initialBearing = persisted?.bearing ?? 0;
    const initialPitch = persisted?.pitch ?? 0;

    // Mobile viewport detection — used downstream to gate the
    // heavier Mapbox options and ambient effects that drove
    // measurable thermal load on phones. Conservative bound:
    // anything at or below 768px gets the trimmed config.
    const isMobileViewport =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 768px)').matches;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      projection: 'globe' as never,
      zoom: initialZoom,
      center: initialCenter,
      bearing: initialBearing,
      pitch: initialPitch,
      // Limites de zoom: máximo 14 = vista de ruas com labels (street level)
      maxZoom: 14,
      minZoom: 1.5,
      interactive: true,
      attributionControl: false,
      // ── Mobile-tuned perf knobs ──
      // `fadeDuration: 0` on mobile skips the 300ms cross-fade
      // every tile + label transition triggers. With globe
      // projection that fade compounds across many simultaneous
      // tile updates during a pinch-zoom; the GPU work was
      // measurable in the thermal profile. Desktop keeps the
      // default 300ms because the fade feels nicer there.
      fadeDuration: isMobileViewport ? 0 : 300,
      // `maxTileCacheSize` capped on mobile so the tile cache
      // doesn't balloon under memory pressure on phones with
      // limited RAM. Desktop gets the Mapbox default (auto).
      maxTileCacheSize: isMobileViewport ? 24 : undefined,
      // `antialias: false` is the Mapbox default but stating it
      // explicit makes the perf intent obvious for future
      // maintainers reading this config block.
      antialias: false,
    });

    // Persist on every settle. `moveend` fires after pan/zoom/
    // rotate stops — captures the final state without spamming
    // localStorage during animations.
    map.on('moveend', () => {
      const center = map.getCenter();
      saveGlobeCamera({
        lng: center.lng,
        lat: center.lat,
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      });
    });

    // ── Container size sync ─────────────────────────────────────
    // Mapbox sizes its WebGL canvas based on the container's
    // dimensions at initialization, then keeps it pinned to that
    // size until `map.resize()` is called. Mapbox's built-in
    // `trackResize` only listens to `window.resize` — which doesn't
    // fire for:
    //   - iOS Safari's address-bar collapse/expand (the layout
    //     viewport stays put while the VISUAL viewport changes)
    //   - in-page layout shifts (route changes, keyboard open,
    //     a sibling sheet pushing the map's box)
    //   - Android orientation changes that the browser delivers
    //     as a layout reflow before any window.resize event
    // The symptom users see is "half the map disappears" — the
    // WebGL canvas stayed at its old smaller dimensions, the
    // background bleeds through wherever the canvas no longer
    // reaches, and the tile imagery just stops at a hard edge.
    //
    // The fix is two listeners, both throttled to one rAF tick so
    // a rapid-fire burst of resize events (iOS rubber-band scroll
    // fires resize many times per second) only triggers one
    // `map.resize()` per frame:
    //   1. ResizeObserver on the container catches every layout-
    //      driven dimension change.
    //   2. visualViewport.resize catches iOS's address-bar dance
    //      where #1 doesn't fire because the layout viewport
    //      didn't change.
    //   3. orientationchange runs both belt-and-suspenders for
    //      Android, where some browsers settle dimensions
    //      mid-orientation-change without firing window.resize.
    //   4. visibilitychange handles the case where the tab was
    //      backgrounded (Mapbox throttles rendering when hidden,
    //      and the container box may have changed while we were
    //      paused — a resize on visibility-restore re-syncs).
    let resizeRafId = 0;
    const scheduleResize = () => {
      if (resizeRafId) return;
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = 0;
        map.resize();
      });
    };
    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(containerRef.current);
    const visualViewport =
      typeof window !== 'undefined' ? window.visualViewport : null;
    visualViewport?.addEventListener('resize', scheduleResize);
    window.addEventListener('orientationchange', scheduleResize);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible: re-snap canvas size in case the
        // container changed while we were backgrounded, and reset
        // the inactivity clock so the idle-spin doesn't kick in
        // the same frame the user comes back. handleActivity is
        // safe before the rotate loop is defined because it only
        // resets state + the inactivity timer — it doesn't touch
        // `rafId` directly.
        scheduleResize();
        handleActivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let userLocationMarker: mapboxgl.Marker | null = null;
    /** Live presence markers keyed by user.id (so diff updates are O(1)) */
    const liveUserMarkers = new Map<string, mapboxgl.Marker>();
    /** Ana Castela check-in pin (singleton). Closed over by the cleanup
     *  function below via a getter ref so the inner handler in
     *  `registerAnaCheckIn` can still rotate its local `anaMarker`
     *  variable. */
    const anaMarkerRef: { current: mapboxgl.Marker | null } = { current: null };

    /** Ana flight (Tour Portugal) airplane marker — singleton.
     *  Lives as a DOM Marker because it needs a click handler +
     *  a rotation transform that follows the great-circle bearing.
     *  The line layers underneath are native Mapbox layers — only
     *  the plane glyph needs to escape into DOM. */
    const anaFlightMarkerRef: { current: mapboxgl.Marker | null } = {
      current: null,
    };
    const anaFlightGlyphRef: { current: HTMLDivElement | null } = {
      current: null,
    };
    /** Latest payload kept in a ref so the marker's click handler
     *  always sees the freshest progress / position when fired —
     *  the handler is wired once at marker creation, so without a
     *  ref it would close over a stale snapshot. */
    const anaFlightLatestRef: {
      current: import('@/lib/globeStore').AnaFlightPayload | null;
    } = { current: null };
    /** Active Mapbox Popup for the show info card. Singleton — one
     *  card at a time. Cleared automatically when the user closes
     *  the popup (× or click outside). */
    const anaShowPopupRef: { current: mapboxgl.Popup | null } = {
      current: null,
    };
    /** Users the current viewer has "waved at" via the heart button on
     *  the expanded badge. Kept in a Set here (not React state) so the
     *  liked-state survives the imperative innerHTML rewrites that
     *  happen when a user's track changes — without persistence the
     *  red heart would flip back to gray on every refresh of the
     *  marker markup. */
    const likedUsers = new Set<string>();

    map.on('style.load', () => {
      map.setFog({
        color: 'rgba(0,0,0,0.9)',
        'high-color': 'rgba(10,18,40,1)',
        'horizon-blend': 0.06,
        'space-color': '#000005',
        'star-intensity': 0.45,
      } as Parameters<typeof map.setFog>[0]);

      // Ambient "fan presence" source — populated by globeStore.setTotalRegistered.
      // Starts empty; the handler below builds the FeatureCollection
      // deterministically around Paraná state cities as soon as we get
      // a real head-count from /api/users/online.
      map.addSource('parana-fans', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Subtle glow halo. Bigger, blurred, low opacity — gives a soft
      // "warm zone" feel at lower zooms, then fades into the dot at
      // street zoom so it doesn't dominate the rua-level view.
      map.addLayer({
        id: 'parana-fans-glow',
        type: 'circle',
        source: 'parana-fans',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            1, 4,
            5, 7,
            9, 11,
            14, 14,
          ],
          'circle-color': '#3ddb74',
          'circle-blur': 1.2,
          'circle-opacity': [
            'interpolate', ['linear'], ['zoom'],
            1, 0.18,
            5, 0.32,
            9, 0.4,
            14, 0.22,
          ],
        },
      });

      // Hard dot in the center of each glow. Stays small but visible
      // at every zoom level — that's the "every dot is a registered
      // fan" affordance the user can rely on at street view too.
      map.addLayer({
        id: 'parana-fans-dot',
        type: 'circle',
        source: 'parana-fans',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            1, 1.4,
            5, 2.2,
            9, 3.2,
            14, 4,
          ],
          'circle-color': '#5dffa1',
          'circle-opacity': 0.95,
          'circle-stroke-color': 'rgba(0,0,0,0.55)',
          'circle-stroke-width': 0.5,
        },
      });

      // ── Ana shows: black-circle-with-ticket pins ──────────────
      //
      // Each show is a BLACK circle with a WHITE ticket icon
      // centered inside, no border. Replaces the previous
      // "calendar chip" approach (big orange circle + day number
      // + month label) per product feedback. The minimal
      // black+ticket combo reads as a generic "event ticket"
      // affordance and ties to the popup's "Ingressos" CTA
      // semantically.
      //
      // The feature collection is populated by registerAnaShows
      // below. Empty at first; the page publishes after mount.
      map.addSource('ana-shows', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Register the ticket icon image once the style is loaded.
      // SVG → data URL → Image → addImage is the lowest-friction
      // path that survives WebGL context loss too (the image
      // re-registers on style.load when this whole block re-runs).
      //
      // The SVG is rendered at 64×64 inside Mapbox; symbol
      // layer's `icon-size` below scales it down to fit the
      // black circle's interior.
      // Stroke color is `#b0b0b0` (a slight gray) per product
      // feedback — was pure white, but the user wanted the
      // ticket icon "levemente cinza" to read as quieter
      // against the show pin's now-translucent circle below.
      const ticketSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="#b0b0b0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a1.5 1.5 0 0 0 0-3z"/><path d="M9 5v14"/></svg>`;
      const ticketImg = new Image(64, 64);
      ticketImg.onload = () => {
        // hasImage check guards against the re-registration that
        // happens if style.load fires twice (theme swap, etc.).
        if (!map.hasImage('show-ticket')) {
          map.addImage('show-ticket', ticketImg);
        }
      };
      ticketImg.src =
        'data:image/svg+xml;base64,' +
        (typeof window !== 'undefined' ? window.btoa(ticketSvg) : '');

      // Black circle body — no border (per product feedback). The
      // dark basemap is dark grey-blue, not pure black, so the
      // chip still reads as a distinct shape even without a
      // stroke. Radius scaled by zoom so the ticket icon inside
      // stays readable from globe-view to street.
      // Opacity 1 → 0.4 (60% transparency) per product feedback —
      // the show pins now sit more subtly on the basemap; the
      // amber halo behind + the slight-gray ticket icon inside
      // keep them identifiable without dominating the surface.
      map.addLayer({
        id: 'ana-shows-dot',
        type: 'circle',
        source: 'ana-shows',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            1, 11,
            5, 14,
            9, 17,
            14, 20,
          ],
          'circle-color': '#000000',
          'circle-stroke-width': 0,
          'circle-opacity': 0.4,
        },
      });

      // White ticket icon painted on top of the black circle.
      // `icon-size` is tuned so the 64px source icon scales down
      // to roughly fit inside the circle interior with some
      // padding. `icon-allow-overlap` + `icon-ignore-placement`
      // ensure the icon never gets culled by Mapbox's collision
      // detector (which would happen with default settings at
      // low zoom where chips cluster).
      map.addLayer({
        id: 'ana-shows-icon',
        type: 'symbol',
        source: 'ana-shows',
        layout: {
          'icon-image': 'show-ticket',
          'icon-size': [
            'interpolate', ['linear'], ['zoom'],
            1, 0.22,
            5, 0.28,
            9, 0.34,
            14, 0.40,
          ],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      // ── Ana Tour Portugal flight — line + airplane ──────────
      //
      // Two GeoJSON sources, two line layers — the "traveled"
      // portion (Londrina → current position, hot pink) and the
      // "remaining" portion (current position → Lisboa, neutral
      // gray). The airplane itself rides on top as a DOM Marker
      // (created later inside registerAnaFlight) so it can carry
      // a click handler and a CSS rotation transform.
      //
      // Both sources start empty; the scheduler in the shell
      // provider publishes the first payload right after mount.
      map.addSource('ana-flight-traveled', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('ana-flight-remaining', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Remaining (gray, dashed) — drawn first so the traveled
      // line paints over it where they share a vertex.
      map.addLayer({
        id: 'ana-flight-remaining-line',
        type: 'line',
        source: 'ana-flight-remaining',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': 'rgba(180, 180, 195, 0.55)',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            1, 1.4,
            5, 1.8,
            10, 2.4,
          ],
          'line-dasharray': [3, 3],
        },
      });

      // Traveled (pink, solid + glow). Two stacked layers — a
      // wider, blurred underlay for the halo + the crisp line on
      // top. Mirrors the "Ana ring" pink that the check-in pin
      // uses, so the whole Ana-overlay system reads as one piece.
      map.addLayer({
        id: 'ana-flight-traveled-glow',
        type: 'line',
        source: 'ana-flight-traveled',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ec4899',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            1, 6,
            5, 8,
            10, 11,
          ],
          'line-opacity': 0.35,
          'line-blur': 4,
        },
      });
      map.addLayer({
        id: 'ana-flight-traveled-line',
        type: 'line',
        source: 'ana-flight-traveled',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#f472b6',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            1, 2.2,
            5, 2.8,
            10, 3.4,
          ],
          'line-opacity': 1,
        },
      });
    });

    // ── Paraná-anchored fan presence dots ────────────────────────────
    // 8 city centers spread across the state. The dot generator cycles
    // through this list (city = i % cities.length) so a population of
    // N spreads naturally; small deterministic jitter from `hashFloat`
    // keeps repeated picks from stacking on top of each other.
    const PARANA_CITIES: Array<[number, number]> = [
      [-49.27, -25.43], // Curitiba
      [-51.16, -23.31], // Londrina
      [-51.94, -23.42], // Maringá
      [-53.46, -24.96], // Cascavel
      [-54.59, -25.55], // Foz do Iguaçu
      [-50.16, -25.09], // Ponta Grossa
      [-51.46, -25.39], // Guarapuava
      [-51.09, -26.23], // União da Vitória
    ];

    /** Deterministic float in [0, 1) seeded by an integer. */
    const hashFloat = (seed: number): number => {
      let h = (seed | 0) ^ 0x9e3779b9;
      h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
      h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };

    const buildParanaFeatures = (count: number): GeoJSON.Feature[] => {
      if (count <= 0) return [];
      const features: GeoJSON.Feature[] = [];
      for (let i = 0; i < count; i++) {
        const city = PARANA_CITIES[i % PARANA_CITIES.length];
        // Two-axis jitter up to ~0.18° (~20 km) so dots don't pile
        // exactly on the city center yet stay clearly within the
        // state's bounding box.
        const jx = (hashFloat(i * 31 + 7) - 0.5) * 0.36;
        const jy = (hashFloat(i * 31 + 17) - 0.5) * 0.36;
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [city[0] + jx, city[1] + jy] },
          properties: { idx: i },
        });
      }
      return features;
    };

    /** Last value we drew — avoids rebuilding the source on equal counts. */
    let lastParanaCount = -1;
    globeStore.registerTotalRegistered((total) => {
      if (total === lastParanaCount) return;
      lastParanaCount = total;
      const src = map.getSource('parana-fans');
      // `getSource` might be undefined if `style.load` hasn't fired yet
      // (handler called from the buffer). Re-try once the style is in.
      if (!src) {
        map.once('style.load', () => {
          const retry = map.getSource('parana-fans');
          if (retry && 'setData' in retry) {
            (retry as mapboxgl.GeoJSONSource).setData({
              type: 'FeatureCollection',
              features: buildParanaFeatures(total),
            });
          }
        });
        return;
      }
      (src as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: buildParanaFeatures(total),
      });
    });

    // ─── Auto-rotation ───────────────────────────────────────────────────────
    // A rotação só liga depois que o mouse fica 6s sem se mover. Qualquer
    // atividade (mouse, teclado, touch, wheel) zera a contagem e desliga
    // imediatamente. Acima do zoom máximo a rotação fica travada de qualquer
    // jeito para não atrapalhar a exploração local.

    const ROTATION_LOCK_ZOOM = 9;
    const INACTIVITY_DELAY_MS = 6000;

    let rotationEnabled = false;        // só vira true quando inativo > 6s
    let userInteracting = false;        // usado pelo flyTo cinemático
    let rafId = 0;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Idle-spin RAF. Self-suspending: when there's no work to do
     * (rotation disabled by recent activity, zoomed past the lock
     * threshold, or actively flying via flyTo), the loop stops
     * scheduling new frames instead of running 60×/sec just to
     * fail the condition. The loop is re-armed by `startRotation`
     * when the inactivity timer expires.
     *
     * The previous version requested a new frame every callback
     * unconditionally — even when rotation was off (the default,
     * since the spin only activates after 6s of inactivity). That
     * meant 60 useless callbacks per second on EVERY device,
     * burning battery for nothing on mobile and keeping the JS
     * thread from idling on desktop.
     */
    const rotate = () => {
      if (!rotationEnabled || userInteracting || map.getZoom() >= ROTATION_LOCK_ZOOM) {
        rafId = 0;
        return;
      }
      map.setCenter([map.getCenter().lng + 0.04, map.getCenter().lat]);
      rafId = requestAnimationFrame(rotate);
    };

    /** Idempotent "kick the loop awake" helper. No-op when the RAF
     *  is already pending. */
    const startRotation = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(rotate);
    };

    /** Marca atividade do usuário: desliga rotação e re-arma timer de 6s.
     *
     *  On mobile we skip the re-arm entirely. The ambient
     *  rotation is a desktop-only flourish — running a 60Hz
     *  RAF that updates the camera every frame on a phone
     *  drove continuous CPU + GPU work for an effect the
     *  small viewport doesn't really showcase. No timer
     *  scheduled = no rotation = idle map stays idle. */
    const handleActivity = () => {
      rotationEnabled = false;
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (isMobileViewport) return;
      inactivityTimer = setTimeout(() => {
        rotationEnabled = true;
        inactivityTimer = null;
        startRotation();
      }, INACTIVITY_DELAY_MS);
    };

    // Eventos page-level cobrem mouse, teclado, touch, wheel — tudo o que o
    // usuário pode fazer no app, não só no canvas do mapa.
    const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'touchmove'] as const;
    ACTIVITY_EVENTS.forEach((ev) => {
      document.addEventListener(ev, handleActivity, { passive: true });
    });

    // Inicia o relógio de inatividade no mount — sem atividade por 6s, gira.
    handleActivity();

    /**
     * Build the "Title — Artist" inner markup. Title in semibold white,
     * artist in regular neutral gray (design-system token). Returns
     * empty string when there's no title at all.
     */
    const buildSongInnerHtml = (
      title: string | null | undefined,
      artist: string | null | undefined,
    ): string => {
      const safeTitle = (title ?? '').replace(/[<>&"']/g, '');
      if (!safeTitle) return '';
      const safeArtist = (artist ?? '').replace(/[<>&"']/g, '');
      const artistMarkup = safeArtist
        ? `<span class="${styles.trackArtist}"> — ${safeArtist}</span>`
        : '';
      return `<span class="${styles.trackTitle}">${safeTitle}</span>${artistMarkup}`;
    };

    /**
     * Build the avatar-wrap markup used by both badge types. Wraps the
     * <img> in a position:relative span so the compact audio-bars chip
     * can be absolutely positioned at the avatar's bottom-right corner.
     * The chip itself is only rendered when there's a track playing —
     * empty pin = no chip.
     */
    const buildAvatarMarkup = (
      avatarSrc: string,
      avatarClass: string,
      hasTrack: boolean,
    ): string => {
      // Compact mode shows a classic "now playing" equalizer — three
      // vertical bars of staggered heights animating in scaleY — inside
      // a fixed-size square container. The container is 14×14 with
      // `border-radius: 50%`, so the chip stays a perfect circle no
      // matter what shape its inner content takes (an earlier
      // implementation used a pill that turned into an oval when the
      // bars were taller than wide; another iteration swapped to dots,
      // which read as low-resolution noise at this scale).
      const barsChip = hasTrack
        ? `<span class="${styles.compactBarsBadge}" aria-hidden="true">
             <span class="${styles.compactBar}"></span>
             <span class="${styles.compactBar}"></span>
             <span class="${styles.compactBar}"></span>
           </span>`
        : '';
      return `
        <span class="${styles.avatarWrap}">
          <img src="${avatarSrc}" alt="" class="${avatarClass}" />
          ${barsChip}
        </span>
      `;
    };

    /**
     * Deterministic radial offset per user id so two presence pins
     * sharing a city centroid land side-by-side instead of stacking.
     * The offset magnitude is zoom-dependent — biggest at globe view
     * (where city-level jitter looks like the same pixel), zero at
     * street zoom where the real coords are already separated.
     *
     *   zoom ≤ 3  → R = 56 px (city-cluster view, max spread)
     *   zoom ≤ 6  → R = 36 px
     *   zoom ≤ 9  → R = 18 px
     *   zoom > 9  → R = 0     (no offset; respect the real coord)
     */
    const hashUserId = (id: string): number => {
      let h = 2166136261;
      for (let i = 0; i < id.length; i++) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    };

    const radiusForZoom = (zoom: number): number => {
      if (zoom <= 3) return 56;
      if (zoom <= 6) return 36;
      if (zoom <= 9) return 18;
      return 0;
    };

    const offsetForUser = (id: string, zoom: number): [number, number] => {
      const R = radiusForZoom(zoom);
      if (R === 0) return [0, 0];
      const h = hashUserId(id);
      // Distribute around a circle; the +0.13 keeps consecutive ids
      // from landing on cardinal directions exclusively.
      const theta = ((h % 360) / 360) * Math.PI * 2 + 0.13;
      return [Math.cos(theta) * R, Math.sin(theta) * R];
    };

    /**
     * Walk every live marker and re-apply its offset based on the
     * current zoom. Cheap (O(N) of presence markers, typically < 50)
     * and only runs on zoom events.
     */
    const reapplyMarkerOffsets = () => {
      const zoom = map.getZoom();
      for (const [id, marker] of liveUserMarkers) {
        marker.setOffset(offsetForUser(id, zoom));
      }
    };

    map.on('zoom', reapplyMarkerOffsets);

    // ── Compact badge mode — collision-driven ──────────────────────
    // Every presence badge (Você + live users) starts as an expanded
    // pill (avatar + name + song row). When two badges' EXPANDED
    // screen-space bounding boxes would overlap, the lower-priority
    // marker collapses to compact mode (28×28 avatar circle only,
    // with the equalizer chip), so the user still sees the person is
    // there but the surface stops being a wall of overlapping text.
    //
    // Priority order:
    //   1. Você (own marker) always wins — it represents the user
    //      themselves and should never collapse just because someone
    //      else is nearby.
    //   2. Among other users, the topmost-on-screen marker wins. The
    //      "winner" is the marker rendered higher up — visually it
    //      already reads as foreground in a top-down layout, so
    //      leaving it expanded matches stacking intuition.
    //
    // Below COMPACT_ZOOM_THRESHOLD (globe-view), we skip detection
    // and just force every badge compact. At that zoom every pair
    // would collide anyway, and the cheaper unconditional path
    // matters because globe-view is where the marker count is
    // highest.
    //
    // Rectangle dimensions are conservative caps that match the CSS
    // upper bounds — actual badges may be narrower (truncated song
    // name) but the cap is what determines collision worst-case.
    const COMPACT_ZOOM_THRESHOLD = 4;
    const COMPACT_SIZE_PX = 28;
    const EXPANDED_WIDTH_PX = 200;
    const EXPANDED_HEIGHT_PX = 56;
    // The badge sits 6px ABOVE the marker anchor (`transform:
    // translate(-50%, calc(-100% - 6px))` in the .userBadge /
    // .liveUserBadge CSS rules).
    const BADGE_ANCHOR_OFFSET_PX = 6;

    interface ScreenRect { x1: number; y1: number; x2: number; y2: number }
    const rectsOverlap = (a: ScreenRect, b: ScreenRect): boolean =>
      !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);

    /**
     * Compute the screen-space bounding box for a marker rendered
     * either compact (28×28) or expanded (200×56), accounting for
     * the marker's own offset (the cluster-fan offset applied via
     * `marker.setOffset` for de-overlap of clustered users at the
     * same coords).
     */
    const getBadgeScreenRect = (
      marker: mapboxgl.Marker,
      compact: boolean,
    ): ScreenRect => {
      const ll = marker.getLngLat();
      const offset = marker.getOffset();
      const p = map.project([ll.lng, ll.lat]);
      const cx = p.x + offset.x;
      const cy = p.y + offset.y;
      const w = compact ? COMPACT_SIZE_PX : EXPANDED_WIDTH_PX;
      const h = compact ? COMPACT_SIZE_PX : EXPANDED_HEIGHT_PX;
      return {
        x1: cx - w / 2,
        y1: cy - BADGE_ANCHOR_OFFSET_PX - h,
        x2: cx + w / 2,
        y2: cy - BADGE_ANCHOR_OFFSET_PX,
      };
    };

    /** Toggle the badgeCompact class on a marker's inner badge, AND
     *  mirror the state to a data-attr on the wrapper element. The
     *  data-attr is the source of truth a marker's innerHTML rewrite
     *  reads from to re-apply the class without flashing the expanded
     *  layout for one frame between rewrite and the next refresh. */
    const setMarkerCompact = (root: HTMLElement, compact: boolean) => {
      const badge = root.querySelector<HTMLElement>(
        '.' + styles.userBadge + ', .' + styles.liveUserBadge,
      );
      if (badge) badge.classList.toggle(styles.badgeCompact, compact);
      root.dataset.compact = compact ? 'true' : 'false';
    };

    /** Synchronous re-application of the last-known compact state for
     *  a freshly-rewritten marker wrapper. Reads `dataset.compact`
     *  (which we wrote on the prior refresh) and sets the class on
     *  the new inner badge. Called right after each `el.innerHTML =
     *  ...` so the markup rewrite doesn't paint an expanded layout
     *  for one frame before the next collision refresh runs. */
    const restoreCompactFromDataset = (root: HTMLElement) => {
      const compact = root.dataset.compact === 'true';
      const badge = root.querySelector<HTMLElement>(
        '.' + styles.userBadge + ', .' + styles.liveUserBadge,
      );
      if (badge) badge.classList.toggle(styles.badgeCompact, compact);
    };

    /** Walk every marker, decide compact-vs-expanded by greedy
     *  collision check, and apply the resulting class. */
    const refreshCollisionState = () => {
      const zoom = map.getZoom();

      interface Entry { marker: mapboxgl.Marker; isOwn: boolean }
      const entries: Entry[] = [];
      if (userLocationMarker) {
        entries.push({ marker: userLocationMarker, isOwn: true });
      }
      for (const [, m] of liveUserMarkers) {
        entries.push({ marker: m, isOwn: false });
      }

      // Globe view: skip the O(N²) check, force-compact everything.
      if (zoom <= COMPACT_ZOOM_THRESHOLD) {
        for (const e of entries) setMarkerCompact(e.marker.getElement(), true);
        return;
      }

      // Sort: own marker first, then by ascending screen-Y (topmost
      // marker wins overlaps below it).
      entries.sort((a, b) => {
        if (a.isOwn !== b.isOwn) return a.isOwn ? -1 : 1;
        const ay = getBadgeScreenRect(a.marker, false).y1;
        const by = getBadgeScreenRect(b.marker, false).y1;
        return ay - by;
      });

      const expandedRects: ScreenRect[] = [];
      for (const e of entries) {
        const r = getBadgeScreenRect(e.marker, false);
        let collides = false;
        for (const other of expandedRects) {
          if (rectsOverlap(r, other)) {
            collides = true;
            break;
          }
        }
        setMarkerCompact(e.marker.getElement(), collides);
        if (!collides) expandedRects.push(r);
      }
    };

    /** rAF-throttled wrapper: a single map pan can fire dozens of
     *  `move` events; coalescing them to one refresh per frame keeps
     *  the O(N²) check off the hot path. */
    let collisionRafId = 0;
    const scheduleCollisionRefresh = () => {
      if (collisionRafId) return;
      collisionRafId = requestAnimationFrame(() => {
        collisionRafId = 0;
        refreshCollisionState();
      });
    };

    // `move` fires for pan, zoom, AND rotate — superset of `zoom`,
    // so this single listener covers every camera change that would
    // shift marker screen positions.
    //
    // On mobile we hook `moveend` only. Running the O(N²) collision
    // check at 60Hz during a touch pan was a measurable thermal
    // contributor on phones; deferring it until the gesture ends
    // brings the work down to one pass per gesture, at the cost of
    // a very brief visual lag where a marker may stay expanded for
    // a frame longer than ideal mid-pan. Desktop keeps the live
    // update because mouse-driven moves are short bursts that
    // benefit from immediate re-layout.
    if (isMobileViewport) {
      map.on('moveend', scheduleCollisionRefresh);
    } else {
      map.on('move', scheduleCollisionRefresh);
    }

    /**
     * Measure the song-row's inner text vs its container width. When
     * the text overflows, set CSS vars + add the marquee-active class
     * so the ping-pong animation kicks in. Duration scales with the
     * overflow amount (4–7s) — faster than the previous 8–12s, since
     * the box is now narrower and the texts that overflow tend to
     * overflow harder.
     *
     * The measurement happens in EXPANDED geometry even when the
     * badge is rendered compact at the moment. Otherwise the song
     * container is sitting at max-width: 0 and we'd compute an
     * overflow equal to the full text width, calibrating the marquee
     * to scroll way too far once the badge expands on hover. Solution:
     * temporarily strip .badgeCompact, force-reflow, measure, then
     * put the class back. Browsers don't paint within a synchronous
     * block, so the user never sees the flicker.
     */
    const activateMarquee = (rootEl: HTMLElement, innerClass: string) => {
      const inner = rootEl.querySelector<HTMLElement>('.' + innerClass);
      if (!inner) return;
      const container = inner.parentElement;
      if (!container) return;

      const badge = rootEl.querySelector<HTMLElement>(
        '.' + styles.userBadge + ', .' + styles.liveUserBadge,
      );
      const wasCompact = badge?.classList.contains(styles.badgeCompact) ?? false;
      if (wasCompact && badge) {
        badge.classList.remove(styles.badgeCompact);
        // Force a sync reflow so the layout reflects the expanded
        // geometry before we read scrollWidth / clientWidth. `void`
        // marks the read as intentionally discarded — passes
        // no-unused-expressions without needing a disable comment.
        void badge.offsetHeight;
      }

      const overflow = inner.scrollWidth - container.clientWidth;

      if (wasCompact && badge) {
        badge.classList.add(styles.badgeCompact);
      }

      if (overflow > 1) {
        const seconds = Math.max(4, Math.min(7, overflow / 48));
        inner.style.setProperty('--marquee-distance', `${overflow}px`);
        inner.style.setProperty('--marquee-duration', `${seconds}s`);
        inner.classList.add(styles.userBadgeSongInnerActive);
      } else {
        inner.classList.remove(styles.userBadgeSongInnerActive);
        inner.style.removeProperty('--marquee-distance');
        inner.style.removeProperty('--marquee-duration');
      }
    };

    /**
     * Heart-burst overlay anchored to a recipient's marker.
     *
     * Per product feedback "Ao clicar no coração que tem no
     * avatar, quem deve receber a chuva de corações é o outro
     * usuário, não o logado. é como se fosse um aceno" — the
     * celebration emanates FROM the targeted user's marker on
     * the map (representing what the receiver would experience)
     * rather than playing the global `app:hearts-cascade`
     * overlay across the sender's whole viewport.
     *
     * Spawns 6 small filled hearts as children of the marker
     * wrapper, each with a random horizontal jitter (±20px)
     * and a staggered animation delay so the cluster reads as
     * a soft pulse rising from the avatar. Each particle runs
     * a single keyframe (`marker-heart-rise` in
     * Globe.module.css) that translates upward + fades out
     * over ~1.4s. The container is removed from the DOM after
     * 1.8s so a fresh click can spawn a clean burst without
     * accumulating stale nodes.
     */
    const spawnHeartsAtMarker = (markerEl: HTMLElement) => {
      if (typeof document === 'undefined') return;
      const burst = document.createElement('div');
      burst.className = styles.markerHeartsBurst;
      burst.setAttribute('aria-hidden', 'true');
      const COUNT = 6;
      for (let i = 0; i < COUNT; i++) {
        const heart = document.createElement('div');
        heart.className = styles.markerHeart;
        const x = (Math.random() - 0.5) * 40;            // ±20px lateral spread
        const delay = Math.random() * 220;               // 0-220ms stagger
        const scale = 0.85 + Math.random() * 0.4;        // 0.85-1.25 size variation
        heart.style.setProperty('--mh-x', `${x}px`);
        heart.style.setProperty('--mh-scale', `${scale}`);
        heart.style.animationDelay = `${delay}ms`;
        heart.innerHTML =
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="#ef4444" aria-hidden="true">' +
          '<path d="M12 21s-7-4.35-9.5-9.5C1 8 3.5 4.5 7 4.5c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 3.5 0 6 3.5 4.5 7-2.5 5.15-9.5 9.5-9.5 9.5z" />' +
          '</svg>';
        burst.appendChild(heart);
      }
      markerEl.appendChild(burst);
      // 220ms max stagger + 1400ms keyframe + 180ms cleanup buffer.
      window.setTimeout(() => {
        burst.remove();
      }, 1800);
    };

    map.on('load', () => {
      // Belt-and-suspenders resize on first paint. React commits
      // the container DOM, then Mapbox initializes — but on slow
      // devices the container's final layout (after fonts/CSS
      // settle) can be a few px different from what Mapbox
      // captured on construction. This single `resize()` snaps
      // the canvas to whatever the container actually is at the
      // moment `load` fires, and is cheap because the canvas is
      // already sized roughly correctly.
      map.resize();
      // Kick the idle-spin loop. It self-suspends immediately if
      // rotation isn't enabled yet (default for the first 6s), so
      // this is a cheap probe — not a 60×/s burner.
      startRotation();

      // Handler de localização do user logado — renderiza um badge no mesmo
      // estilo do liveUserBadge (avatar + nome + música), ancorado em
      // [lng, lat] real. Sempre rotulado "Você"; distinção visual fica no
      // anel ciano do avatar.
      globeStore.registerUserLocation((payload) => {
        if (userLocationMarker) {
          userLocationMarker.remove();
          userLocationMarker = null;
        }
        if (!payload) return;

        const { coords, avatarUrl, name, trackTitle, trackArtist } = payload;
        // Sanitize before injecting into innerHTML.
        const safeName   = (name ?? 'Você').replace(/[<>&"']/g, '');
        const safeAvatar = (avatarUrl ?? '').replace(/["<>]/g, '');
        const safeTitle  = (trackTitle ?? '').replace(/[<>&"']/g, '');
        // Empty avatarUrl on the "Você" map marker now falls back
        // to the generic silhouette instead of a deterministic
        // pravatar.cc photo — brand-new users no longer see a
        // random stranger's face pinned to their own location on
        // the globe. Per product feedback "Quando um novo usuário
        // for cadastrado, deixe sem foto alguma no avatar".
        const avatarSrc  = safeAvatar || '/avatar-placeholder.svg';
        const songInnerHtml = buildSongInnerHtml(trackTitle, trackArtist);

        const audioBarsHtml = `
          <span class="${styles.audioBars}" aria-hidden="true">
            <span></span><span></span><span></span><span></span>
          </span>`;

        const el = document.createElement('div');
        el.className = styles.userLocationMarker;
        // Avatar lives inside an .avatarWrap so a tiny audio-bars chip
        // can overlay at its bottom-right when the badge collapses to
        // compact mode at low zoom. The .userBadgeInfo block holds the
        // expanded row content — it smoothly slides away in compact
        // mode and back in on hover.
        const avatarHtml = buildAvatarMarkup(
          avatarSrc,
          styles.userBadgeAvatar,
          !!safeTitle,
        );
        el.innerHTML = `
          <span class="${styles.userLocationPulse}" aria-hidden="true"></span>
          <div class="${styles.userBadge}" role="img" aria-label="${safeName} (sua localização, online)${safeTitle ? ` ouvindo ${safeTitle}` : ''}">
            ${avatarHtml}
            <div class="${styles.userBadgeInfo}">
              <span class="${styles.userBadgeName}">${safeName}${audioBarsHtml}</span>
              ${songInnerHtml ? `<div class="${styles.userBadgeSong}"><span class="${styles.userBadgeSongInner}">${songInnerHtml}</span></div>` : ''}
            </div>
          </div>
        `;
        userLocationMarker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([coords.lng, coords.lat])
          .addTo(map);
        // Synchronous initial state: Você is always priority so it
        // defaults to EXPANDED. The refresh below confirms (or, if
        // someone's right on top of us at globe zoom, the refresh
        // ends up forcing compact anyway).
        setMarkerCompact(el, false);
        scheduleCollisionRefresh();
        // Measure after mount so scrollWidth/clientWidth reflect the
        // real laid-out element. requestAnimationFrame buys a frame
        // for layout to settle.
        if (songInnerHtml) {
          requestAnimationFrame(() => activateMarquee(el, styles.userBadgeSongInner));
        }
      });

      // ── Live presence markers (other users) ──────────────────────────
      // The Globe component owns marker lifecycle (create/update/remove)
      // keyed by user.id. The list of users is pushed from AppPage via
      // globeStore.setLiveUsers whenever /api/users/online refreshes.
      globeStore.registerLiveUsers((users) => {
        const nextIds = new Set(users.map((u) => u.id));

        // Remove markers for users that disappeared. A removal opens
        // up screen real estate that a neighboring compact marker
        // can now reclaim — schedule a refresh after the removals
        // run so the survivors expand if room permits.
        let didRemove = false;
        for (const [id, marker] of liveUserMarkers) {
          if (!nextIds.has(id)) {
            marker.remove();
            liveUserMarkers.delete(id);
            didRemove = true;
          }
        }
        if (didRemove) scheduleCollisionRefresh();

        for (const u of users) {
          // Sanitize before innerHTML.
          const safeName = (u.name ?? 'Anônimo').replace(/[<>&"']/g, '');
          const safeAvatar = (u.avatarUrl ?? '').replace(/["<>]/g, '');
          const safeTitle = (u.trackTitle ?? '').replace(/[<>&"']/g, '');
          const avatarSrc = safeAvatar || `https://i.pravatar.cc/72?u=${u.id}`;
          const songInnerHtml = buildSongInnerHtml(u.trackTitle, u.trackArtist);

          const audioBarsHtml = `
            <span class="${styles.audioBars}" aria-hidden="true">
              <span></span><span></span><span></span><span></span>
            </span>`;

          // Equalizer bars sit next to the name on every online-user
          // badge — a steady visual cue that this person is live on
          // the platform. Song row uses the same marquee-capable
          // structure as the "Você" pin so long titles ping-pong
          // instead of widening the card.
          const avatarHtml = buildAvatarMarkup(
            avatarSrc,
            styles.liveUserAvatar,
            !!safeTitle,
          );
          // Heart "like / wave" affordance — appears in the
          // expanded badge state (on hover). Gray at rest, red
          // after click (.liked). State is read from the
          // `likedUsers` Set above so the color survives badge
          // innerHTML rewrites. The actual click logic lives on
          // the wrapper's delegated click listener below
          // (it intercepts the heart before the wrapper-level
          // "open profile" handler fires).
          const liked = likedUsers.has(u.id);
          const heartHtml = `
            <button
              type="button"
              class="${styles.likeBtn} ${liked ? styles.liked : ''}"
              aria-label="${liked ? 'Você acenou' : 'Acenar para esse usuário'}"
              aria-pressed="${liked ? 'true' : 'false'}"
              data-user-id="${u.id}"
              data-user-name="${safeName}"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          `;
          const html = `
            <div class="${styles.liveUserBadge}" role="img" aria-label="${safeName} (online)${safeTitle ? ` ouvindo ${safeTitle}` : ''}">
              ${avatarHtml}
              <div class="${styles.liveUserInfo}">
                <span class="${styles.liveUserName}">${safeName}${audioBarsHtml}</span>
                ${songInnerHtml ? `<div class="${styles.liveUserSong}"><span class="${styles.userBadgeSongInner}">${songInnerHtml}</span></div>` : ''}
              </div>
              ${heartHtml}
            </div>
          `;

          const existing = liveUserMarkers.get(u.id);
          if (existing) {
            // Reuse the DOM element to avoid flicker. Position update is
            // cheap on Mapbox markers.
            const el = existing.getElement();
            if (el.innerHTML !== html) {
              el.innerHTML = html;
              // The new innerHTML doesn't carry the compact class —
              // restore it from the wrapper's data-compact attr
              // (set by setMarkerCompact on the prior refresh) so
              // the rewrite doesn't flash the expanded layout for
              // one frame before the next collision refresh lands.
              restoreCompactFromDataset(el);
              // Marker contents changed (track switch) but its
              // position didn't — still re-schedule a collision
              // pass in case the new song-row width changes the
              // collision picture in some edge case, AND so any
              // peer markers added between refreshes get picked up.
              scheduleCollisionRefresh();
              if (songInnerHtml) {
                requestAnimationFrame(() =>
                  activateMarquee(el, styles.userBadgeSongInner),
                );
              }
            }
            existing.setLngLat([u.lng, u.lat]);
          } else {
            const wrapper = document.createElement('div');
            wrapper.className = styles.liveUserWrap;
            wrapper.innerHTML = html;
            // Click → flyTo this user's spot
            wrapper.style.cursor = 'pointer';
            // Click on a live presence pin handles two cases:
            //  (a) heart button — toggle the liked state, fire
            //      `app:user-waved` so the rest of the app can
            //      surface a "you waved at X" toast / send a
            //      backend notification. stopPropagation keeps the
            //      profile from opening on the same click.
            //  (b) anywhere else — fly camera + open ProfilePanel
            //      (the original behaviour).
            // Delegation is intentional: the badge's innerHTML is
            // regenerated whenever the user's track changes, so
            // attaching the click directly to the heart would be
            // lost on every refresh. The wrapper itself isn't
            // recreated, so this listener survives.
            wrapper.addEventListener('click', (e) => {
              const target = e.target as HTMLElement;
              const heartBtn = target.closest<HTMLButtonElement>(
                `.${styles.likeBtn}`,
              );
              if (heartBtn) {
                e.stopPropagation();
                const userId = heartBtn.dataset.userId ?? u.id;
                const userName = heartBtn.dataset.userName ?? safeName;
                const wasLiked = likedUsers.has(userId);
                if (wasLiked) {
                  likedUsers.delete(userId);
                } else {
                  likedUsers.add(userId);
                }
                // Update the heart's visual state without rebuilding
                // the entire badge — just toggle the class + flip
                // the SVG fill so the transition is instant.
                heartBtn.classList.toggle(styles.liked);
                heartBtn.setAttribute(
                  'aria-pressed',
                  wasLiked ? 'false' : 'true',
                );
                heartBtn.setAttribute(
                  'aria-label',
                  wasLiked ? 'Acenar para esse usuário' : 'Você acenou',
                );
                const svg = heartBtn.querySelector('svg');
                if (svg) {
                  svg.setAttribute('fill', wasLiked ? 'none' : 'currentColor');
                }
                // Telemetry — fire user_waved on the on-toggle and
                // user_unwaved on the off-toggle. `source` lets us
                // segment heart actions coming from the map vs the
                // ProfilePanel when that surface also wires waves in.
                if (wasLiked) {
                  track('user_unwaved', {
                    target_user_id: userId,
                    source: 'globe_marker',
                  });
                } else {
                  track('user_waved', {
                    target_user_id: userId,
                    target_user_name: userName,
                    source: 'globe_marker',
                  });
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(
                      new CustomEvent('app:user-waved', {
                        detail: { userId, name: userName },
                      }),
                    );
                  }
                  // Hearts celebration emanates from the RECEIVING
                  // marker on the sender's map (visual confirmation
                  // that the wave landed) — see Globe.module.css
                  // `.markerHeartsBurst` for the animation.
                  spawnHeartsAtMarker(wrapper);

                  // Push the wave through the socket so the SERVER
                  // can insert the `notifications` row + emit
                  // `notify:new` to the recipient's personal room.
                  // That's the leg the receiver was missing —
                  // before this, the heart only updated the
                  // sender's local DOM + telemetry, so the
                  // recipient never saw a notification or fired
                  // their own hearts cascade. Per product feedback
                  // "Estou com dois usuários online e as
                  // notificações de coração só aparecem para o
                  // usuário que fez, o que recebeu não chegou".
                  // Fire-and-forget — the server handler ACKs but
                  // the UX doesn't depend on the ack (the local
                  // burst above is already on screen).
                  try {
                    const s = getSocket();
                    s.emit('wave:send', { targetUserId: userId });
                  } catch (err) {
                    console.error('wave:send emit failed:', err);
                  }
                }
                return;
              }
              map.flyTo({ center: [u.lng, u.lat], zoom: 11, duration: 1400 });
              globeStore.openUserProfile(u.id);
            });
            const marker = new mapboxgl.Marker({
              element: wrapper,
              anchor: 'center',
              offset: offsetForUser(u.id, map.getZoom()),
            })
              .setLngLat([u.lng, u.lat])
              .addTo(map);
            liveUserMarkers.set(u.id, marker);
            // Synchronous initial state: start COMPACT so the first
            // frame doesn't flash a wall of overlapping expanded
            // pills (worst-case visual). The refresh below promotes
            // this marker to expanded if it has room — much better
            // UX than "all big pills, then collapse" since small
            // avatars never visually clash.
            setMarkerCompact(wrapper, true);
            scheduleCollisionRefresh();
            if (songInnerHtml) {
              requestAnimationFrame(() =>
                activateMarquee(wrapper, styles.userBadgeSongInner),
              );
            }
          }
        }
      });

      // ── Ana Castela check-in pin ──────────────────────────────
      //
      // Singleton marker: the page publishes at most one check-in at
      // a time via globeStore.setAnaCheckIn(payload). We rebuild the
      // pin from scratch whenever the payload changes (cheap — a
      // single DOM node) and remove it entirely on `null`. The pin
      // owns its own click handler that hands the payload back to
      // the page through globeStore.openAnaCheckIn so the modal can
      // open without React touching imperative map state.
      globeStore.registerAnaCheckIn((payload) => {
        if (anaMarkerRef.current) {
          anaMarkerRef.current.remove();
          anaMarkerRef.current = null;
        }
        if (!payload) return;

        const safeCity = payload.city.replace(/[<>&"']/g, '');
        const safeState = payload.state.replace(/[<>&"']/g, '');

        const wrapper = document.createElement('div');
        wrapper.className = styles.anaCheckInWrap;
        wrapper.style.cursor = 'pointer';
        // Pulse ring + circular avatar with the hot-pink "Ana ring"
        // + a small violet map-pin chip overlaid on the avatar's
        // bottom-right corner (signals "she's somewhere on the
        // map"). The "Ana fez check-in em <City>" pill stays hidden
        // by default — appears only on hover/focus per the latest
        // spec; the avatar + map-pin pair is the resting visual.
        wrapper.innerHTML = `
          <span class="${styles.anaPulse}" aria-hidden="true"></span>
          <span class="${styles.anaPulseB}" aria-hidden="true"></span>
          <div class="${styles.anaAvatarRing}" role="img" aria-label="Ana Castela fez check-in em ${safeCity}-${safeState}">
            <img src="/ana-castela.png" alt="" class="${styles.anaAvatar}" />
            <span class="${styles.anaMapBadge}" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 14s5-4.5 5-9a5 5 0 0 0-10 0c0 4.5 5 9 5 9z" />
                <circle cx="8" cy="5" r="1.8" />
              </svg>
            </span>
          </div>
          <div class="${styles.anaBadge}">
            <span class="${styles.anaBadgeDot}" aria-hidden="true"></span>
            <span class="${styles.anaBadgeText}">
              <span class="${styles.anaBadgeLine1}">Ana fez check-in em</span>
              <strong class="${styles.anaBadgeLine2}">${safeCity}-${safeState}</strong>
            </span>
          </div>
        `;

        wrapper.addEventListener('click', (e) => {
          e.stopPropagation();
          globeStore.openAnaCheckIn(payload);
          track('ana_checkin_pin_clicked', {
            checkin_id: payload.id,
            city: payload.city,
            state: payload.state,
          });
        });

        anaMarkerRef.current = new mapboxgl.Marker({
          element: wrapper,
          anchor: 'bottom',
        })
          .setLngLat([payload.lng, payload.lat])
          .addTo(map);
      });

      // ── Ana Castela upcoming shows ────────────────────────────
      //
      // Pins are drawn as native Mapbox circle + symbol layers (set
      // up inside `style.load` above). This handler just feeds the
      // GeoJSON source. Each feature carries the precomputed `dateChip`
      // ("DD/MM") used by the symbol layer's `text-field` and the
      // `fullDate` (long-form "02 de julho de 2026") used by the
      // click-opened popover.
      //
      // Sanitization isn't needed inside `properties` because we
      // pass them through Mapbox's feature interface — values are
      // never injected into HTML except the popup builder below,
      // which sanitizes there.
      globeStore.registerAnaShows((shows) => {
        const features: GeoJSON.Feature[] = shows.map((show) => {
          const dateObj = new Date(show.date + 'T12:00:00');
          const dd = String(dateObj.getDate()).padStart(2, '0');
          const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
          const dateChip = `${dd}/${mm}`;
          // `fullDate` is the long-form "16 de maio de 2026"
          // string the show popup uses. The previous `day` and
          // `monthShort` properties were retired alongside the
          // calendar-chip layer redesign — the pin is now just a
          // black circle + white ticket icon with no in-pin text.
          const fullDate = new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          }).format(dateObj);
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [show.lng, show.lat] },
            properties: {
              id: show.id,
              venue: show.venue,
              city: show.city,
              state: show.state,
              dateChip,
              fullDate,
            },
          };
        });

        const apply = () => {
          const src = map.getSource('ana-shows');
          if (!src) return false;
          (src as mapboxgl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features,
          });
          return true;
        };
        // If the style hasn't loaded yet (race on first publish),
        // retry once when it does. Same pattern parana-fans uses.
        if (!apply()) {
          map.once('style.load', () => {
            apply();
          });
        }
      });

      // ── Ana Tour Portugal flight ──────────────────────────────
      //
      // The shell provider publishes a fresh payload every minute.
      // Each tick we:
      //   1. Update both line sources (traveled + remaining)
      //   2. Reposition + re-rotate the airplane DOM marker, creating
      //      it once if it doesn't exist yet.
      //
      // Passing `null` removes the marker entirely — used when the
      // tour ends (no caller does this today, but the path is wired
      // so the future "end of tour" flag can clear the overlay).
      globeStore.registerAnaFlight((payload) => {
        anaFlightLatestRef.current = payload;

        const applyLineData = (): boolean => {
          const traveledSrc = map.getSource('ana-flight-traveled') as
            | mapboxgl.GeoJSONSource
            | undefined;
          const remainingSrc = map.getSource('ana-flight-remaining') as
            | mapboxgl.GeoJSONSource
            | undefined;
          if (!traveledSrc || !remainingSrc) return false;
          if (!payload) {
            traveledSrc.setData({ type: 'FeatureCollection', features: [] });
            remainingSrc.setData({ type: 'FeatureCollection', features: [] });
            return true;
          }
          traveledSrc.setData({
            type: 'FeatureCollection',
            features: payload.traveledPath.length >= 2 ? [{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: payload.traveledPath.map((p) => [p[0], p[1]] as [number, number]),
              },
              properties: {},
            }] : [],
          });
          remainingSrc.setData({
            type: 'FeatureCollection',
            features: payload.remainingPath.length >= 2 ? [{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: payload.remainingPath.map((p) => [p[0], p[1]] as [number, number]),
              },
              properties: {},
            }] : [],
          });
          return true;
        };

        // Apply now, or wait for style.load if we beat the
        // map ready signal. Same retry pattern as registerAnaShows.
        if (!applyLineData()) {
          map.once('style.load', () => {
            applyLineData();
          });
        }

        // Null payload → tear down the airplane marker too.
        if (!payload) {
          if (anaFlightMarkerRef.current) {
            anaFlightMarkerRef.current.remove();
            anaFlightMarkerRef.current = null;
            anaFlightGlyphRef.current = null;
          }
          return;
        }

        // Create or reuse the marker. The wrapper holds a
        // rotatable inner div so the click target stays
        // axis-aligned (no skewed hit box) while the airplane
        // SVG itself rotates to follow the bearing.
        if (!anaFlightMarkerRef.current) {
          const wrapper = document.createElement('div');
          wrapper.className = styles.anaFlightWrap;
          wrapper.style.cursor = 'pointer';
          // Airplane silhouette — top-down view, nose UP at native
          // orientation. Two paths: solid pink fill for the body
          // and a thin white outline that lifts the plane against
          // any basemap color. Replaces the paper-airplane (Send)
          // glyph used in v1 — that one read as "DM/message" more
          // than "in-flight aircraft" once paired with a route line.
          wrapper.innerHTML = `
            <div class="${styles.anaFlightGlyph}" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
                  fill="currentColor"
                  stroke="rgba(255, 255, 255, 0.92)"
                  stroke-width="0.8"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <span class="${styles.anaFlightLabel}" aria-hidden="true">
              Tour Portugal
            </span>
          `;
          wrapper.setAttribute('role', 'button');
          wrapper.setAttribute('aria-label', 'Ana Castela em voo — Tour Portugal');
          wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            const latest = anaFlightLatestRef.current;
            if (!latest) return;
            globeStore.openAnaFlight(latest);
            track('ana_flight_pin_clicked', {
              progress: Math.round(latest.progress * 100),
              arrived: latest.arrived,
            });
          });
          anaFlightGlyphRef.current = wrapper.querySelector(
            `.${styles.anaFlightGlyph}`,
          ) as HTMLDivElement | null;
          anaFlightMarkerRef.current = new mapboxgl.Marker({
            element: wrapper,
            anchor: 'center',
          })
            .setLngLat([payload.position.lng, payload.position.lat])
            .addTo(map);
        } else {
          // Reuse existing marker — just move + rotate.
          anaFlightMarkerRef.current.setLngLat([
            payload.position.lng,
            payload.position.lat,
          ]);
        }

        // Rotate the inner glyph to point along the bearing. The
        // new airplane SVG points UP at its native orientation, so
        // no offset is needed — a bearing of 0° (north) keeps the
        // nose pointing straight up, and +bearing rotates clockwise
        // as compass bearings do.
        if (anaFlightGlyphRef.current) {
          anaFlightGlyphRef.current.style.transform = `rotate(${payload.bearingDeg}deg)`;
        }
      });

      // ── Show pin → info card popup ────────────────────────────
      //
      // Click on the orange dot opens a Mapbox Popup anchored to
      // the city with venue / city / date / Ingressos. closeOnClick
      // closes the popup when the user taps anywhere else on the
      // map — same gesture the Mapbox geocoder uses.
      //
      // The Ingressos button is intentionally inert per spec: it
      // only fires telemetry. When a ticket partner ships, swap
      // the no-op for a `window.open(show.ticketUrl)`.
      const buildShowPopupHtml = (props: {
        id: string;
        venue: string;
        city: string;
        state: string;
        fullDate: string;
      }): string => {
        const safeVenue = (props.venue ?? '').replace(/[<>&"']/g, '');
        const safeCity = (props.city ?? '').replace(/[<>&"']/g, '');
        const safeState = (props.state ?? '').replace(/[<>&"']/g, '');
        const safeDate = (props.fullDate ?? '').replace(/[<>&"']/g, '');
        const safeId = (props.id ?? '').replace(/[<>&"']/g, '');
        return `
          <div class="${styles.anaShowPopupBody}">
            <h3 class="${styles.anaShowCardVenue}">${safeVenue}</h3>
            <span class="${styles.anaShowCardCity}">${safeCity}-${safeState}</span>
            <span class="${styles.anaShowCardDate}">${safeDate}</span>
            <button
              type="button"
              class="${styles.anaShowCardCta}"
              data-show-id="${safeId}"
              data-venue="${safeVenue}"
            >
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2 6a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1a1 1 0 0 0 0 2v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 0 0-2V6z" />
                <path d="M6 5v6" />
              </svg>
              Ingressos
            </button>
          </div>
        `;
      };

      map.on('click', 'ana-shows-dot', (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties as {
          id: string;
          venue: string;
          city: string;
          state: string;
          fullDate: string;
        };
        const coords = (feature.geometry as GeoJSON.Point).coordinates.slice(
          0,
          2,
        ) as [number, number];

        if (anaShowPopupRef.current) {
          anaShowPopupRef.current.remove();
          anaShowPopupRef.current = null;
        }

        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: true,
          offset: 14,
          className: styles.anaShowPopup,
          maxWidth: '260px',
        })
          .setLngLat(coords)
          .setHTML(buildShowPopupHtml(props))
          .addTo(map);

        // Delegated listener for the Ingressos button. The popup
        // element only exists after `addTo`, so we grab it now.
        // Mapbox types model `getElement()` as possibly undefined
        // (pre-attach), but after `addTo(map)` it's always defined.
        const popupEl = popup.getElement();
        popupEl?.addEventListener('click', (ev) => {
          const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>(
            '[data-show-id]',
          );
          if (!btn) return;
          ev.stopPropagation();
          track('ana_show_tickets_clicked', {
            show_id: btn.dataset.showId ?? '',
            venue: btn.dataset.venue ?? '',
          });
          // CTA intentionally inert — placeholder for ticketUrl wiring.
        });

        popup.on('close', () => {
          if (anaShowPopupRef.current === popup) {
            anaShowPopupRef.current = null;
          }
        });

        anaShowPopupRef.current = popup;

        track('ana_show_pin_clicked', {
          show_id: props.id,
          city: props.city,
          venue: props.venue,
        });
      });

      // Pointer cursor while hovering an orange dot.
      map.on('mouseenter', 'ana-shows-dot', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'ana-shows-dot', () => {
        map.getCanvas().style.cursor = '';
      });

      globeStore.register((center, zoom) => {
        userInteracting = true;
        cancelAnimationFrame(rafId);
        if (resumeTimer) clearTimeout(resumeTimer);

        map.flyTo({
          center,
          zoom,
          duration: 5500,
          curve: 2.5,
          speed: 0.4,
          pitch: 45,
          bearing: -20,
          essential: true,
          easing: (t) => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2,
        });

        resumeTimer = setTimeout(() => {
          map.flyTo({
            zoom: 1.8,
            pitch: 0,
            bearing: 0,
            duration: 3500,
            curve: 1.8,
            essential: true,
            easing: (t) => 1 - Math.pow(1 - t, 3),
          });
          setTimeout(() => {
            userInteracting = false;
            startRotation();
          }, 3600);
        }, 6500);
      });
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (resumeTimer) clearTimeout(resumeTimer);
      if (inactivityTimer) clearTimeout(inactivityTimer);
      ACTIVITY_EVENTS.forEach((ev) => {
        document.removeEventListener(ev, handleActivity);
      });
      // Tear down the resize plumbing added above so a re-mount
      // doesn't leak listeners on top of fresh ones.
      if (resizeRafId) cancelAnimationFrame(resizeRafId);
      if (collisionRafId) cancelAnimationFrame(collisionRafId);
      resizeObserver.disconnect();
      visualViewport?.removeEventListener('resize', scheduleResize);
      window.removeEventListener('orientationchange', scheduleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // CRITICAL: null out every globeStore callback the Globe owns
      // BEFORE `map.remove()` below. Otherwise an in-flight socket
      // update (presence change, Ana check-in, etc.) landing during
      // the mobile unmount-remount gap would invoke the OLD closures,
      // which hold a reference to the now-destroyed `map`. Mapbox's
      // Marker.addTo(map) calls `map.getCanvasContainer()` internally;
      // on a destroyed map that returns undefined, so `.appendChild`
      // throws `undefined is not an object`. Nulling the callbacks
      // shunts incoming updates into the buffer slot where they wait
      // for the next Globe instance to register and replay them.
      globeStore.unregisterMapCallbacks();
      if (userLocationMarker) userLocationMarker.remove();
      liveUserMarkers.forEach((m) => m.remove());
      liveUserMarkers.clear();
      if (anaMarkerRef.current) {
        anaMarkerRef.current.remove();
        anaMarkerRef.current = null;
      }
      if (anaFlightMarkerRef.current) {
        anaFlightMarkerRef.current.remove();
        anaFlightMarkerRef.current = null;
        anaFlightGlyphRef.current = null;
      }
      if (anaShowPopupRef.current) {
        anaShowPopupRef.current.remove();
        anaShowPopupRef.current = null;
      }
      // The orange dots + label are part of the map style, so
      // `map.remove()` below tears them down automatically.
      map.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div ref={containerRef} className={styles.map} />
      <div className={styles.vignette} aria-hidden="true" />
    </>
  );
}
