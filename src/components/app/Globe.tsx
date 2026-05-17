'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { globeStore } from '@/lib/globeStore';
import { track } from '@/lib/analytics';
import styles from './Globe.module.css';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// ─────────────────────────────────────────────────────────────────────────────

export default function Globe() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      projection: 'globe' as never,
      zoom: 1.8,
      center: [15, 20],
      // Limites de zoom: máximo 14 = vista de ruas com labels (street level)
      maxZoom: 14,
      minZoom: 1.5,
      interactive: true,
      attributionControl: false,
    });

    let userLocationMarker: mapboxgl.Marker | null = null;
    /** Live presence markers keyed by user.id (so diff updates are O(1)) */
    const liveUserMarkers = new Map<string, mapboxgl.Marker>();
    /** Ana Castela check-in pin (singleton). Closed over by the cleanup
     *  function below via a getter ref so the inner handler in
     *  `registerAnaCheckIn` can still rotate its local `anaMarker`
     *  variable. */
    const anaMarkerRef: { current: mapboxgl.Marker | null } = { current: null };
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

      // ── Ana shows: native circle + symbol layers ──────────────────
      //
      // The shows agenda is now drawn AS PART OF THE MAP: a soft
      // amber halo, a hard orange dot, and a zoom-gated "Show DD/MM"
      // label. This replaces the old HTML chip markers — the points
      // are now locked to lng/lat the same way streets and labels
      // are, so they don't feel like overlays drifting over the map.
      //
      // The feature collection is populated by registerAnaShows
      // below. Empty at first; the page publishes after mount.
      map.addSource('ana-shows', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Soft amber glow behind each dot.
      map.addLayer({
        id: 'ana-shows-glow',
        type: 'circle',
        source: 'ana-shows',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            1, 7,
            5, 10,
            9, 14,
            14, 18,
          ],
          'circle-color': '#fbbf24',
          'circle-blur': 1.2,
          'circle-opacity': 0.45,
        },
      });

      // Hard orange dot — the "bolinha" the spec asks for.
      map.addLayer({
        id: 'ana-shows-dot',
        type: 'circle',
        source: 'ana-shows',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            1, 4,
            5, 5.5,
            9, 7,
            14, 9,
          ],
          'circle-color': '#f97316', // orange-500
          'circle-stroke-color': 'rgba(255, 255, 255, 0.9)',
          'circle-stroke-width': 1.4,
          'circle-opacity': 1,
        },
      });

      // "Show DD/MM" label — invisible until the user zooms in
      // enough that the dot's city is identifiable (zoom ≥ 8). The
      // halo keeps the text legible against any basemap color.
      map.addLayer({
        id: 'ana-shows-label',
        type: 'symbol',
        source: 'ana-shows',
        layout: {
          'text-field': ['concat', 'Show dia ', ['get', 'dateChip']],
          'text-size': 12,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-allow-overlap': true,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        },
        paint: {
          'text-color': '#fde68a',
          'text-halo-color': 'rgba(0,0,0,0.85)',
          'text-halo-width': 1.4,
          'text-opacity': [
            'interpolate', ['linear'], ['zoom'],
            6.5, 0,
            8, 1,
          ],
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

    const rotate = () => {
      if (rotationEnabled && !userInteracting && map.getZoom() < ROTATION_LOCK_ZOOM) {
        map.setCenter([map.getCenter().lng + 0.04, map.getCenter().lat]);
      }
      rafId = requestAnimationFrame(rotate);
    };

    /** Marca atividade do usuário: desliga rotação e re-arma timer de 6s. */
    const handleActivity = () => {
      rotationEnabled = false;
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        rotationEnabled = true;
        inactivityTimer = null;
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

    // ── Compact badge mode at low zoom ─────────────────────────────
    // When the camera is pulled back beyond COMPACT_ZOOM_THRESHOLD,
    // every presence badge (Você + live) collapses to "avatar only"
    // with a tiny audio-bars chip overlay. On hover any badge still
    // expands to the full row via CSS — no JS needed for the
    // interaction itself. Zoom-in past the threshold de-compacts
    // every badge at once.
    const COMPACT_ZOOM_THRESHOLD = 4;
    const isCompactZoom = () => map.getZoom() <= COMPACT_ZOOM_THRESHOLD;

    const applyCompactClass = (root: HTMLElement | null | undefined) => {
      if (!root) return;
      const badge = root.querySelector<HTMLElement>(
        '.' + styles.userBadge + ', .' + styles.liveUserBadge,
      );
      if (!badge) return;
      badge.classList.toggle(styles.badgeCompact, isCompactZoom());
    };

    const reapplyCompactState = () => {
      if (userLocationMarker) applyCompactClass(userLocationMarker.getElement());
      for (const [, marker] of liveUserMarkers) {
        applyCompactClass(marker.getElement());
      }
    };

    map.on('zoom', reapplyCompactState);

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

    map.on('load', () => {
      rafId = requestAnimationFrame(rotate);

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
        const avatarSrc  = safeAvatar || 'https://i.pravatar.cc/72?u=me';
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
        // Apply the current compact state immediately so a fresh
        // marker at globe-zoom shows up collapsed instead of flashing
        // expanded for a frame.
        applyCompactClass(el);
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

        // Remove markers for users that disappeared.
        for (const [id, marker] of liveUserMarkers) {
          if (!nextIds.has(id)) {
            marker.remove();
            liveUserMarkers.delete(id);
          }
        }

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
              // re-apply it based on the current zoom so a track-change
              // re-render doesn't flash the expanded layout.
              applyCompactClass(el);
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
            applyCompactClass(wrapper);
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
        // + a violet pill badge stacked on two lines:
        //   line 1 — "Ana fez check-in em" (light weight, smaller)
        //   line 2 — "<City>-<UF>"          (bold, larger)
        // The wrapper itself is the click target, so the whole pin
        // is tappable — not just the avatar.
        wrapper.innerHTML = `
          <span class="${styles.anaPulse}" aria-hidden="true"></span>
          <span class="${styles.anaPulseB}" aria-hidden="true"></span>
          <div class="${styles.anaAvatarRing}" role="img" aria-label="Ana Castela fez check-in em ${safeCity}-${safeState}">
            <img src="/ana-castela.png" alt="" class="${styles.anaAvatar}" />
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
          // Once the user has opened the check-in, collapse the pin
          // to "avatar-only" mode for the rest of its lifetime —
          // the badge text reappears on hover. Stops the same banner
          // from nagging after the user has already seen the
          // content. The class persists through the linger window
          // and is naturally lost when the next spawn rebuilds the
          // marker DOM.
          wrapper.classList.add(styles.anaCheckInOpened);
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
            rafId = requestAnimationFrame(rotate);
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
      if (userLocationMarker) userLocationMarker.remove();
      liveUserMarkers.forEach((m) => m.remove());
      liveUserMarkers.clear();
      if (anaMarkerRef.current) {
        anaMarkerRef.current.remove();
        anaMarkerRef.current = null;
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
