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

        const { coords, avatarUrl, name, trackTitle } = payload;
        // Sanitize before injecting into innerHTML.
        const safeName   = (name ?? 'Você').replace(/[<>&"']/g, '');
        const safeAvatar = (avatarUrl ?? '').replace(/["<>]/g, '');
        const safeTitle  = (trackTitle ?? '').replace(/[<>&"']/g, '');
        const avatarSrc  = safeAvatar || 'https://i.pravatar.cc/72?u=me';

        const audioBarsHtml = `
          <span class="${styles.audioBars}" aria-hidden="true">
            <span></span><span></span><span></span><span></span>
          </span>`;

        const el = document.createElement('div');
        el.className = styles.userLocationMarker;
        // The equalizer bars always render next to the name so the
        // "Você" pin reads as a live, listening presence even before
        // any track loads. When a song is playing we also show the
        // title underneath; the bars stay anchored to the name row
        // to avoid duplication.
        el.innerHTML = `
          <span class="${styles.userLocationPulse}" aria-hidden="true"></span>
          <div class="${styles.userBadge}" role="img" aria-label="${safeName} (sua localização, online)${safeTitle ? ` ouvindo ${safeTitle}` : ''}">
            <img src="${avatarSrc}" alt="" class="${styles.userBadgeAvatar}" />
            <div class="${styles.userBadgeInfo}">
              <span class="${styles.userBadgeName}">${safeName}${audioBarsHtml}</span>
              ${safeTitle ? `<span class="${styles.userBadgeSong}">${safeTitle}</span>` : ''}
            </div>
          </div>
        `;
        userLocationMarker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([coords.lng, coords.lat])
          .addTo(map);
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

          const audioBarsHtml = `
            <span class="${styles.audioBars}" aria-hidden="true">
              <span></span><span></span><span></span><span></span>
            </span>`;

          // Equalizer bars sit next to the name on every online-user
          // badge — a steady visual cue that this person is live on
          // the platform. The song row stays text-only.
          const html = `
            <div class="${styles.liveUserBadge}" role="img" aria-label="${safeName} (online)${safeTitle ? ` ouvindo ${safeTitle}` : ''}">
              <img src="${avatarSrc}" alt="" class="${styles.liveUserAvatar}" />
              <div class="${styles.liveUserInfo}">
                <span class="${styles.liveUserName}">${safeName}${audioBarsHtml}</span>
                ${safeTitle ? `<span class="${styles.liveUserSong}">${safeTitle}</span>` : ''}
              </div>
            </div>
          `;

          const existing = liveUserMarkers.get(u.id);
          if (existing) {
            // Reuse the DOM element to avoid flicker. Position update is
            // cheap on Mapbox markers.
            const el = existing.getElement();
            if (el.innerHTML !== html) el.innerHTML = html;
            existing.setLngLat([u.lng, u.lat]);
          } else {
            const wrapper = document.createElement('div');
            wrapper.className = styles.liveUserWrap;
            wrapper.innerHTML = html;
            // Click → flyTo this user's spot
            wrapper.style.cursor = 'pointer';
            wrapper.addEventListener('click', () => {
              map.flyTo({ center: [u.lng, u.lat], zoom: 11, duration: 1400 });
            });
            const marker = new mapboxgl.Marker({ element: wrapper, anchor: 'center' })
              .setLngLat([u.lng, u.lat])
              .addTo(map);
            liveUserMarkers.set(u.id, marker);
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
