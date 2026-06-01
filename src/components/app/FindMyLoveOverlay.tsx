'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Map as MapboxMap } from 'mapbox-gl';
import FanverseCore from '@/components/animations/FanverseCore';
import { globeStore } from '@/lib/globeStore';
import { CITY_SEEDS } from '@/lib/mapSimulation/cities';
import styles from './FindMyLoveOverlay.module.css';

/* ============================================================
 * Estados:
 *   - searching (10s): orbe FanverseCore centralizado + dimmer
 *     escuro + frases que ciclam em loop ("Lendo suas preferências
 *     musicais", "Seu histórico de fã", etc). Mapa atrás permanece
 *     quieto. Per feedback "substitua o globo atual pelo orbe, dure
 *     10s, e cicle as frases".
 *   - revealing (~3.4s): orbe faz fade-out, mapa real anima:
 *     zoom-out + bearing 40° (giro), pitch leve, depois volta
 *     pro centro entre user e match. Overlay vira só o dimmer
 *     com texto "Encontrando seu match…".
 *   - matched (sticky): linha verde + avatar do match no mapa,
 *     CARD CENTRALIZADO na página com info de afinidade musical.
 * ============================================================ */

type Phase = 'searching' | 'revealing' | 'matched';

/* Origin = SP (placeholder pro user atual). Em produção viria
 * do perfil do usuário (cidade de login). */
const USER_ORIGIN: [number, number] = [-46.6333, -23.5505];

const PRAVATAR_IDS = [1, 5, 11, 13, 17, 23, 29, 33, 41, 47, 53, 61];
const FIRST_NAMES = [
  'Lily', 'Ethan', 'Aria', 'Noah', 'Mia', 'Liam', 'Zoe', 'Kai',
  'Yara', 'Theo', 'Sora', 'Léa', 'Anya', 'Felix', 'Iris', 'Milo',
];

/* Frases ciclando durante o SEARCHING. Última ("Pronto!") aparece
 * brevemente antes da transição pro REVEALING — funciona como
 * "click" de fim da busca. */
const SEARCH_PHRASES = [
  'Lendo suas preferências musicais.',
  'Seu histórico de fã',
  'Procurando afinidades musicais',
  'Encontrando...',
  'Pronto!',
];
/* Duração total do SEARCHING = 10s, dividida igualmente pelas 5
 * frases (2s cada). Pronto! aparece no último slot e logo em
 * seguida vem o REVEALING. */
const SEARCHING_DURATION_MS = 10000;
const PHRASE_INTERVAL_MS = SEARCHING_DURATION_MS / SEARCH_PHRASES.length;

interface MatchInfo {
  name: string;
  city: string;
  country: string;
  center: [number, number];
  picId: number;
  /* Métricas simuladas pra card de afinidade. */
  affinity: number;       // % afinidade musical
  sameMomentCount: number; // vezes que ouviram a mesma música no mesmo momento
}

function pickInternationalMatch(): MatchInfo {
  const intl = CITY_SEEDS.filter((c) => c.country !== 'BR');
  const city = intl[Math.floor(Math.random() * intl.length)];
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const picId = PRAVATAR_IDS[Math.floor(Math.random() * PRAVATAR_IDS.length)];
  /* Affinity em faixa alta (88-99%) — narrativa de "match", não
   * dado real. sameMoment 3-9 (números plausíveis pro tempo de
   * uso de um fã). */
  const affinity = 88 + Math.floor(Math.random() * 12);
  const sameMomentCount = 3 + Math.floor(Math.random() * 7);
  return {
    name: firstName,
    city: city.name,
    country: city.country,
    center: city.center,
    picId,
    affinity,
    sameMomentCount,
  };
}

/* IDs dos source/layer da animação no Mapbox. */
const SRC_LINE   = 'fml-line';
const LAYER_LINE = 'fml-line-layer';

export default function FindMyLoveOverlay({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('searching');
  const [phraseIdx, setPhraseIdx] = useState(0);
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

  // SEARCHING (10s) → cicla frases a cada 2s → REVEALING
  useEffect(() => {
    if (phase !== 'searching') return;

    setPhraseIdx(0);
    const phraseInterval = window.setInterval(() => {
      setPhraseIdx((i) => {
        // Trava no último ("Pronto!") até o switch pro revealing
        if (i >= SEARCH_PHRASES.length - 1) return i;
        return i + 1;
      });
    }, PHRASE_INTERVAL_MS);

    const done = window.setTimeout(
      () => setPhase('revealing'),
      SEARCHING_DURATION_MS,
    );

    return () => {
      window.clearInterval(phraseInterval);
      window.clearTimeout(done);
    };
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
    // Zoom mínimo 2.5 — abaixo disso os outros gates do app
    // (LAYER_HEAT minzoom 2.5, MapPulses tooFarOut) escondem tudo,
    // então preservamos o teto inferior pra mesma sequência funcionar.
    map.easeTo({
      zoom: 2.5,
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
          /* minzoom 2.5 — per feedback "no zoom abaixo de 2.5,
           * oculte os elementos plotados no mapa". */
          minzoom: 2.5,
          paint: {
            /* Discreto: cinza claro com leve tracejado. Antes era
             * pink-500 sólido — chamava muita atenção. */
            'line-color': 'rgba(245, 245, 247, 0.55)',
            'line-width': 1,
            'line-opacity': 0.7,
            'line-dasharray': [3, 3],
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

      /* Hide markers em z<2.5 per feedback "oculte elementos
       * plotados no mapa abaixo de 2.5". */
      const applyMarkerVisibility = () => {
        const z = map.getZoom();
        const hide = z < 2.5;
        if (markerRef.current) {
          markerRef.current.getElement().style.visibility = hide ? 'hidden' : 'visible';
        }
        if (userMarkerRef.current) {
          userMarkerRef.current.getElement().style.visibility = hide ? 'hidden' : 'visible';
        }
      };
      map.on('zoom', applyMarkerVisibility);
      applyMarkerVisibility();
      (map as unknown as { _fmlZoomHandler?: () => void })._fmlZoomHandler =
        applyMarkerVisibility;

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
          const handler = (map as unknown as { _fmlZoomHandler?: () => void })._fmlZoomHandler;
          if (handler) {
            map.off('zoom', handler);
            (map as unknown as { _fmlZoomHandler?: () => void })._fmlZoomHandler = undefined;
          }
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

      {/* SEARCHING: orbe FanverseCore + frase rotativa */}
      {phase === 'searching' && (
        <div className={styles.searchStage}>
          <div className={styles.orb} aria-hidden="true">
            <FanverseCore />
          </div>
          {/* Frase com key={phraseIdx} pra forçar remount → fadeIn
           * a cada troca. */}
          <div className={styles.searchText} key={phraseIdx}>
            {SEARCH_PHRASES[phraseIdx]}
          </div>
        </div>
      )}

      {/* REVEALING: texto sutil enquanto mapa anima */}
      {phase === 'revealing' && (
        <div className={styles.revealText}>Encontrando seu match…</div>
      )}

      {/* MATCHED: card CENTRALIZADO com info de afinidade.
       * Sem bordas/cores fortes, segue design system (dark glass
       * com text-secondary). */}
      {phase === 'matched' && (
        <div className={styles.matchCard}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.pravatar.cc/120?img=${match.picId}`}
            alt={match.name}
            className={styles.matchCardAvatar}
          />
          <div className={styles.matchCardName}>{match.name}</div>
          <div className={styles.matchCardCity}>
            {match.city}, {match.country}
          </div>

          <div className={styles.matchFacts}>
            <div className={styles.matchFact}>
              {match.name} ouve as mesmas músicas que você todos os dias.
            </div>
            <div className={styles.matchFact}>
              Vocês têm <strong>{match.affinity}%</strong> de afinidade musical
            </div>
            <div className={styles.matchFact}>
              Já ouviram a mesma música no mesmo momento <strong>{match.sameMomentCount}x</strong>
            </div>
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
              Mandar oi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
