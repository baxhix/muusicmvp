'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Map as MapboxMap } from 'mapbox-gl';
import { globeStore } from '@/lib/globeStore';
import { CITY_SEEDS } from '@/lib/mapSimulation/cities';
import styles from './FindMyLoveOverlay.module.css';

/* ============================================================
 * Estados:
 *   - searching (4s): globo gigante centralizado + texto "Em busca
 *     pelo mundo". Mapa atrás permanece quieto.
 *   - revealing (~2.5s): globo do overlay faz fade-out, mapa real
 *     anima: zoom-out + bearing 40° (giro), pitch leve, depois
 *     volta pro centro entre user e match. Overlay vira só o
 *     dimmer escuro com texto "Encontrando seu match...".
 *   - matched (sticky): linha verde + avatar do match no mapa,
 *     card mostrando "X em [cidade, país]" + ações.
 * ============================================================ */

type Phase = 'searching' | 'revealing' | 'matched';

/* Origin = SP (placeholder pro user atual). Em produção viria
 * do perfil do usuário (cidade de login). */
const USER_ORIGIN: [number, number] = [-46.6333, -23.5505];
const USER_CITY_LABEL = 'São Paulo, BR';

const PRAVATAR_IDS = [1, 5, 11, 13, 17, 23, 29, 33, 41, 47, 53, 61];
const FIRST_NAMES = [
  'Lily', 'Ethan', 'Aria', 'Noah', 'Mia', 'Liam', 'Zoe', 'Kai',
  'Yara', 'Theo', 'Sora', 'Léa', 'Anya', 'Felix', 'Iris', 'Milo',
];

interface MatchInfo {
  name: string;
  city: string;
  country: string;
  center: [number, number];
  picId: number;
}

function pickInternationalMatch(): MatchInfo {
  const intl = CITY_SEEDS.filter((c) => c.country !== 'BR');
  const city = intl[Math.floor(Math.random() * intl.length)];
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const picId = PRAVATAR_IDS[Math.floor(Math.random() * PRAVATAR_IDS.length)];
  return {
    name: firstName,
    city: city.name,
    country: city.country,
    center: city.center,
    picId,
  };
}

/* IDs dos source/layer da animação no Mapbox. */
const SRC_LINE   = 'fml-line';
const LAYER_LINE = 'fml-line-layer';

export default function FindMyLoveOverlay({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('searching');
  const matchRef = useRef<MatchInfo | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);

  if (!matchRef.current) {
    matchRef.current = pickInternationalMatch();
  }
  const match = matchRef.current;

  // Pega o map instance
  useEffect(() => {
    const unsubscribe = globeStore.subscribeMapInstance((m) => {
      mapRef.current = (m ?? null) as MapboxMap | null;
    });
    return unsubscribe;
  }, []);

  // SEARCHING (4s) → REVEALING
  useEffect(() => {
    if (phase !== 'searching') return;
    const t = window.setTimeout(() => setPhase('revealing'), 4000);
    return () => window.clearTimeout(t);
  }, [phase]);

  // REVEALING: anima mapa
  useEffect(() => {
    if (phase !== 'revealing') return;
    const map = mapRef.current;
    if (!map) {
      // Sem mapa, pula direto pra matched
      const t = window.setTimeout(() => setPhase('matched'), 1000);
      return () => window.clearTimeout(t);
    }

    // Stage 1: zoom out + bearing rotation (1.5s)
    map.easeTo({
      zoom: 1.8,
      bearing: 40,
      pitch: 25,
      duration: 1500,
      essential: true,
    });

    // Stage 2 (after 1.6s): volta + centro entre user e match
    const t1 = window.setTimeout(() => {
      const midLng = (USER_ORIGIN[0] + match.center[0]) / 2;
      const midLat = (USER_ORIGIN[1] + match.center[1]) / 2;
      // Distância determina zoom: cidades muito distantes precisam zoom out maior
      const dx = Math.abs(USER_ORIGIN[0] - match.center[0]);
      const dy = Math.abs(USER_ORIGIN[1] - match.center[1]);
      const dist = Math.max(dx, dy);
      const targetZoom = dist > 90 ? 1.6 : dist > 50 ? 2.2 : 2.8;

      map.easeTo({
        center: [midLng, midLat],
        zoom: targetZoom,
        bearing: 0,
        pitch: 0,
        duration: 1800,
        essential: true,
      });
    }, 1600);

    // Stage 3 (after 3.4s): adiciona linha + markers + vai pra 'matched'
    const t2 = window.setTimeout(() => {
      // Source + layer da linha
      if (!map.getSource(SRC_LINE)) {
        map.addSource(SRC_LINE, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [USER_ORIGIN, match.center],
            },
            properties: {},
          },
        });
      }
      if (!map.getLayer(LAYER_LINE)) {
        map.addLayer({
          id: LAYER_LINE,
          type: 'line',
          source: SRC_LINE,
          paint: {
            'line-color': '#ec4899',  // pink-500
            'line-width': 2,
            'line-opacity': 0.85,
            'line-dasharray': [2, 2],
          },
        });
      }

      // Marker pin no user (origem)
      const userEl = document.createElement('div');
      userEl.className = `${styles.endpoint} ${styles.userEndpoint}`;
      userMarkerRef.current = new mapboxgl.Marker({ element: userEl, anchor: 'center' })
        .setLngLat(USER_ORIGIN)
        .addTo(map);

      // Marker avatar no match
      const el = document.createElement('div');
      el.className = styles.matchAvatar;
      el.style.backgroundImage = `url('https://i.pravatar.cc/100?img=${match.picId}')`;
      markerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(match.center)
        .addTo(map);

      setPhase('matched');
    }, 3400);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [phase, match]);

  // Cleanup ao fechar
  useEffect(() => {
    return () => {
      const map = mapRef.current;
      if (map) {
        try {
          if (map.getLayer(LAYER_LINE))  map.removeLayer(LAYER_LINE);
          if (map.getSource(SRC_LINE))   map.removeSource(SRC_LINE);
        } catch { /* map destruído */ }
      }
      try { markerRef.current?.remove(); } catch { /* já removido */ }
      try { userMarkerRef.current?.remove(); } catch { /* já removido */ }
    };
  }, []);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      {/* Camada escura — opacity vária por fase */}
      <div
        className={`${styles.dim} ${phase !== 'searching' ? styles.dimLight : ''}`}
        onClick={phase === 'matched' ? onClose : undefined}
      />

      {/* SEARCHING: globo gigante + texto */}
      {phase === 'searching' && (
        <div className={styles.searchStage}>
          <div className={styles.globe} aria-hidden="true">🌍</div>
          <div className={styles.searchText}>Em busca pelo mundo</div>
          <div className={styles.searchDots}>
            <span /><span /><span />
          </div>
        </div>
      )}

      {/* REVEALING: texto sutil enquanto mapa anima */}
      {phase === 'revealing' && (
        <div className={styles.revealText}>Encontrando seu match…</div>
      )}

      {/* MATCHED: card com info do match + ações */}
      {phase === 'matched' && (
        <div className={styles.matchCard}>
          <img
            src={`https://i.pravatar.cc/120?img=${match.picId}`}
            alt={match.name}
            className={styles.matchCardAvatar}
          />
          <div className={styles.matchCardName}>{match.name}</div>
          <div className={styles.matchCardCity}>
            {match.city}, {match.country}
          </div>
          <div className={styles.matchCardLine}>
            ↔ {USER_CITY_LABEL}
          </div>
          <div className={styles.matchActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
            >
              Fechar
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                try {
                  window.dispatchEvent(
                    new CustomEvent('app:mock-direct-open', {
                      detail: {
                        name: match.name,
                        picId: match.picId,
                        text: '',
                        sourceId: `fml-${match.city}`,
                      },
                    }),
                  );
                } catch { /* ignore */ }
                onClose();
              }}
            >
              Mandar oi 💜
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
