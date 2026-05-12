'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { globeStore } from '@/lib/globeStore';
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
      // Compact mode shows only 3 bars — fewer, calmer rhythm than the
      // 4-bar inline indicator next to the name. The 4th bar's CSS
      // nth-child rule simply has no element to apply to here.
      const barsChip = hasTrack
        ? `<span class="${styles.compactBarsBadge}" aria-hidden="true">
             <span class="${styles.audioBars}">
               <span></span><span></span><span></span>
             </span>
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
        // Force a reflow so the layout reflects the expanded geometry
        // before we read scrollWidth / clientWidth.
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        badge.offsetHeight;
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
          const html = `
            <div class="${styles.liveUserBadge}" role="img" aria-label="${safeName} (online)${safeTitle ? ` ouvindo ${safeTitle}` : ''}">
              ${avatarHtml}
              <div class="${styles.liveUserInfo}">
                <span class="${styles.liveUserName}">${safeName}${audioBarsHtml}</span>
                ${songInnerHtml ? `<div class="${styles.liveUserSong}"><span class="${styles.userBadgeSongInner}">${songInnerHtml}</span></div>` : ''}
              </div>
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
            // Click on a live presence pin: fly the camera there
            // AND open this user's ProfilePanel. Both happen — the
            // flyTo gives the spatial confirmation, the panel gives
            // the social context (avatar, fanpoints, message/wave).
            wrapper.addEventListener('click', () => {
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
