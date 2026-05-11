'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { globeStore } from '@/lib/globeStore';
import {
  REGULAR_FANS,
  GLOBE_DOTS,
  CLUSTERS,
  CITY_HUBS,
  formatHubCount,
  formatContinentCount,
  type Cluster,
  type CityHub,
} from '@/data/mapUsers';
import styles from './Globe.module.css';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

const formatCount = (n: number) => n.toLocaleString('pt-BR');

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

    /** Track HTML markers so we can show/hide based on zoom */
    const clusterMarkers: mapboxgl.Marker[] = [];
    const hubMarkers: mapboxgl.Marker[] = [];
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

      // ─── Source: regular fans ──────────────────────────────────────────────
      map.addSource('regular-fans', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: REGULAR_FANS.map(([lng, lat]) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [lng, lat] },
            properties: {},
          })),
        },
      });

      // ─── Source: globe dots (~70 pontos esparsos visíveis em zoom 1.5–3) ──
      map.addSource('globe-dots', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: GLOBE_DOTS.map(([lng, lat]) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [lng, lat] },
            properties: {},
          })),
        },
      });

      map.addLayer({
        id: 'globe-dots-layer',
        type: 'circle',
        source: 'globe-dots',
        minzoom: 1.5,
        maxzoom: 3.5,
        paint: {
          // No zoom global, dots ficam claros como 2x2px (radius 1.2 com
          // anti-aliasing rende um quadrado nítido de 2px)
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            1.5, 1.2,
            2.5, 1,
            3.2, 0.6,
            3.5, 0,
          ],
          'circle-color': '#3DDB74',
          'circle-opacity': [
            'interpolate', ['linear'], ['zoom'],
            1.5, 0.95,
            2.5, 0.7,
            3.2, 0.3,
            3.5, 0,
          ],
        },
      });

      // Tiny dots — visíveis a partir do zoom continental (2.2) com presença
      // crescente conforme aproxima do zoom máximo. Garante pontos verdes
      // sempre presentes ao redor de cidades em qualquer altura de visão.
      map.addLayer({
        id: 'fan-dots-tiny',
        type: 'circle',
        source: 'regular-fans',
        minzoom: 2.2,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            2.2, 0.7,
            3,   1,         // 2px no zoom continental
            4,   1.1,
            6,   1.5,
            8,   2,
            10,  2.6,
          ],
          'circle-color': '#3DDB74',
          'circle-opacity': [
            'interpolate', ['linear'], ['zoom'],
            2.2, 0,
            2.8, 0.55,      // já bem visíveis ao se aproximar do continente
            3.5, 0.8,
            4.5, 0.9,
            10,  0.95,
          ],
        },
      });

      // Halo sutil — vai aparecendo junto com os dots
      map.addLayer({
        id: 'fan-dots-glow',
        type: 'circle',
        source: 'regular-fans',
        minzoom: 3,
        paint: {
          'circle-radius': 5,
          'circle-color': '#3DDB74',
          'circle-opacity': [
            'interpolate', ['linear'], ['zoom'],
            3,   0,
            4.5, 0.08,
            7,   0.18,
          ],
          'circle-blur': 1,
        },
      });

      // ─── Viewport-bound layer: 300 pontos verdes no que o usuário vê ─────
      // Ao chegar no zoom alto, 300 pontos 1x1px são gerados nos limites
      // visíveis do mapa. Atualiza em moveend para acompanhar o pan.
      map.addSource('viewport-fans', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'viewport-fans-layer',
        type: 'circle',
        source: 'viewport-fans',
        minzoom: 7,
        paint: {
          // 2x2px estabelecido a partir do zoom 8; cresce ligeiramente até street view (14)
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            7,   0.6,
            8,   1,         // 2x2px aqui
            10,  1.2,
            14,  1.6,       // ~3x3px em street level (mais visível entre as ruas)
          ],
          'circle-color': '#3DDB74',
          'circle-opacity': [
            'interpolate', ['linear'], ['zoom'],
            7,   0,
            7.8, 0.55,
            8.5, 0.85,
            10,  1,
            14,  1,
          ],
        },
      });

      // Geração inicial — caso o usuário comece zoom alto via flyTo
      regenerateViewportFans();

      // ─── HTML markers: pulsing cluster waves ───────────────────────────────
      CLUSTERS.forEach((cluster) => {
        const el = buildClusterMarker(cluster);
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(cluster.center)
          .addTo(map);
        clusterMarkers.push(marker);
      });

      // ─── HTML markers: hub badges (+N usuários no zoom alto) ──────────────
      CITY_HUBS.forEach((hub) => {
        const el = buildHubBadgeMarker(hub);
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(hub.coords)
          .addTo(map);
        hubMarkers.push(marker);
      });

      // ─── Apply initial visibility based on zoom ────────────────────────────
      applyZoomVisibility(map.getZoom());
    });

    /** Show/hide marker types based on zoom + scale wave size inversely */
    function applyZoomVisibility(zoom: number) {
      const showClusters = zoom < 4.5;

      // Onda cobre o continente inteiro no zoom global; encolhe suavemente
      // conforme o usuário se aproxima de país/cidade.
      const ringSize =
        zoom < 1.5 ? 90 :
        zoom < 2.2 ? 72 :
        zoom < 3.0 ? 54 :
        zoom < 3.6 ? 38 :
                     26;

      clusterMarkers.forEach((m) => {
        const el = m.getElement();
        // Onda some progressivamente entre zoom 3 e 4.5 (transição com os dots)
        let opacity = 1;
        if (zoom > 3) opacity = Math.max(0, 1 - (zoom - 3) / 1.5);
        el.style.opacity = String(opacity);
        el.style.pointerEvents = showClusters ? 'auto' : 'none';
        el.style.setProperty('--ring-base-size', `${ringSize}px`);
      });

      // Hub badges progressivos por zoom:
      //   9.2 → 10  : todos os 23 badges visíveis (cidade fechada)
      //   8   → 9.2 : apenas 1 badge (mais próximo do centro do viewport)
      //   4.5 → 8   : apenas 4 badges (4 mais próximos do centro)
      //   < 4.5     : nenhum badge
      let visibleCount = 0;
      if (zoom >= 9.2)      visibleCount = CITY_HUBS.length; // todos
      else if (zoom >= 8)   visibleCount = 1;
      else if (zoom >= 4.5) visibleCount = 4;
      else                  visibleCount = 0;

      let allowedHubIds: Set<string> = new Set();
      if (visibleCount > 0 && visibleCount < CITY_HUBS.length) {
        const c = map.getCenter();
        const ranked = CITY_HUBS
          .map((h) => ({
            id: h.id,
            d: Math.hypot(h.coords[0] - c.lng, h.coords[1] - c.lat),
          }))
          .sort((a, b) => a.d - b.d)
          .slice(0, visibleCount);
        allowedHubIds = new Set(ranked.map((r) => r.id));
      }

      hubMarkers.forEach((m, idx) => {
        const hub = CITY_HUBS[idx];
        const el = m.getElement();
        const isVisible =
          visibleCount === CITY_HUBS.length
            ? true
            : visibleCount === 0
              ? false
              : allowedHubIds.has(hub.id);
        el.classList.toggle(styles.hubBadgeVisible, isVisible);
      });

      // Continent badges (sobre cada onda pulsante): visíveis só em zoom 1.5–3
      const showContinents = zoom >= 1.5 && zoom <= 3.2;
      clusterMarkers.forEach((m) => {
        const el = m.getElement();
        el.classList.toggle(styles.clusterContinentVisible, showContinents);
      });
    }

    map.on('zoom', () => applyZoomVisibility(map.getZoom()));
    // Safety: re-apply quando o mapa termina qualquer movimento, garantindo
    // que markers recém-adicionados peguem o estado atual de visibilidade.
    map.once('idle', () => applyZoomVisibility(map.getZoom()));

    /**
     * Gera pontos aleatórios estáveis dentro do bounds visível, filtrando
     * pixels que caem em corpos d'água via Mapbox `queryRenderedFeatures`.
     * - Zoom 6.5 → 9.2: ~300 pontos
     * - Zoom 9.2 → 14:  ~600 pontos concentrados (60% central)
     */
    function regenerateViewportFans() {
      const zoom = map.getZoom();
      if (zoom < 6.5) return;
      const bounds = map.getBounds();
      if (!bounds) return;
      const center = map.getCenter();
      let seed =
        (((Math.floor(center.lng * 8) & 0xFFFF) ^
          ((Math.floor(center.lat * 8) & 0xFFFF) << 16)) >>> 0) || 1;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0xFFFFFFFF;
      };

      const isMaxZoom = zoom >= 9.2;
      const targetCount = isMaxZoom ? 600 : 300;

      const margin = isMaxZoom ? 0.20 : 0;
      const fullW = bounds.getEast() - bounds.getWest();
      const fullH = bounds.getNorth() - bounds.getSouth();
      const w = bounds.getWest()  + fullW * margin;
      const e = bounds.getEast()  - fullW * margin;
      const s = bounds.getSouth() + fullH * margin;
      const n = bounds.getNorth() - fullH * margin;

      // Mapbox renderiza features 'water' nas tiles atuais. Para cada candidato,
      // projetamos para pixel e perguntamos se cai sobre uma feature de água.
      const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
      let attempts = 0;
      while (features.length < targetCount && attempts < targetCount * 5) {
        attempts++;
        const lng = w + rand() * (e - w);
        const lat = s + rand() * (n - s);
        const px = map.project([lng, lat]);
        const hit = map.queryRenderedFeatures(px, { layers: undefined })
          .some((f) => f.layer?.id?.toLowerCase().includes('water'));
        if (hit) continue;
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: {},
        });
      }

      const src = map.getSource('viewport-fans') as mapboxgl.GeoJSONSource | undefined;
      src?.setData({ type: 'FeatureCollection', features });
    }

    map.on('moveend', regenerateViewportFans);
    map.on('zoomend', regenerateViewportFans);

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
      // estilo do FloatingUsers (avatar + nome em pill), ancorado em
      // [lng, lat] real. Sempre rotulado "Você".
      globeStore.registerUserLocation((payload) => {
        if (userLocationMarker) {
          userLocationMarker.remove();
          userLocationMarker = null;
        }
        if (!payload) return;

        const { coords, avatarUrl, name } = payload;
        // Sanitize before injecting into innerHTML.
        const safeName   = (name ?? 'Você').replace(/[<>&"']/g, '');
        const safeAvatar = (avatarUrl ?? '').replace(/["<>]/g, '');
        const avatarSrc  = safeAvatar || 'https://i.pravatar.cc/72?u=me';

        const el = document.createElement('div');
        el.className = styles.userLocationMarker;
        el.innerHTML = `
          <span class="${styles.userLocationPulse}" aria-hidden="true"></span>
          <div class="${styles.userBadge}" role="img" aria-label="${safeName} (sua localização)">
            <img src="${avatarSrc}" alt="" class="${styles.userBadgeAvatar}" />
            <div class="${styles.userBadgeInfo}">
              <span class="${styles.userBadgeName}">${safeName}</span>
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

          const html = `
            <div class="${styles.liveUserBadge}" role="img" aria-label="${safeName}${safeTitle ? ` ouvindo ${safeTitle}` : ''}">
              <img src="${avatarSrc}" alt="" class="${styles.liveUserAvatar}" />
              <div class="${styles.liveUserInfo}">
                <span class="${styles.liveUserName}">${safeName}</span>
                ${safeTitle ? `<span class="${styles.liveUserSong}">♪ ${safeTitle}</span>` : ''}
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
      clusterMarkers.forEach((m) => m.remove());
      hubMarkers.forEach((m) => m.remove());
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

// ─────────────────────────────────────────────────────────────────────────────
// Marker builders — vanilla DOM elements (Mapbox markers don't accept React)
// ─────────────────────────────────────────────────────────────────────────────

/** Hash estável a partir de um id, para gerar offsets determinísticos por cluster. */
function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildClusterMarker(cluster: Cluster): HTMLElement {
  const variantClass =
    cluster.type === 'listening' ? styles.clusterListening :
                                   styles.clusterEvent;

  const el = document.createElement('div');
  el.className = `${styles.clusterMarker} ${variantClass}`;
  el.style.transition = 'opacity 380ms ease';

  // ── Stagger por cluster: delay e duração variam pra romper a sincronia.
  const h = hashId(cluster.id);
  const ringDelay    = (h % 380) / 100;            // 0.00 → 3.80s
  const ringDuration = 4.0 + ((h >>> 8) % 240) / 100; // 4.00 → 6.40s
  el.style.setProperty('--ring-delay',    `${ringDelay.toFixed(2)}s`);
  el.style.setProperty('--ring-duration', `${ringDuration.toFixed(2)}s`);

  el.innerHTML = `
    <span class="${styles.clusterRing} ${styles.clusterRingA}" aria-hidden="true"></span>
    <span class="${styles.clusterRing} ${styles.clusterRingB}" aria-hidden="true"></span>
    <span class="${styles.clusterCore}" aria-hidden="true"></span>
    <div class="${styles.clusterContinentBadge}" aria-label="Total ${formatContinentCount(cluster.count)} ouvintes">
      <span class="${styles.clusterContinentDot}" aria-hidden="true"></span>
      <span class="${styles.clusterContinentCount}">${escapeHtml(formatContinentCount(cluster.count))}</span>
    </div>
    <div class="${styles.clusterTooltip}" role="tooltip">
      <strong>${formatCount(cluster.count)}</strong> ouvintes na ${escapeHtml(cluster.city)}
    </div>
  `;
  return el;
}

function buildHubBadgeMarker(hub: CityHub): HTMLElement {
  const el = document.createElement('div');
  el.className = styles.hubBadge;
  // opacity/pointer-events controladas pelo CSS via classe .hubBadgeVisible
  el.innerHTML = `
    <span class="${styles.hubBadgeDot}" aria-hidden="true"></span>
    <span class="${styles.hubBadgeCount}">${escapeHtml(formatHubCount(hub.count))}</span>
  `;
  return el;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
