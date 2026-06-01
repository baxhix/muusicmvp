'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Map as MapboxMap } from 'mapbox-gl';
import FanverseCore from '@/components/animations/FanverseCore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { globeStore } from '@/lib/globeStore';
import { CITY_SEEDS, type Country } from '@/lib/mapSimulation/cities';
import styles from './FindMyLoveOverlay.module.css';

/* Display em PT-BR de cada code de país — formato "{preposição}
 * {nome}" pra encaixar direto na frase "Sua afinidade musical está
 * em {city}, {COUNTRY_DISPLAY[country]}". Ex.: IE → "na Irlanda"
 * resulta em "...está em Dublin, na Irlanda."
 *
 * Preposições escolhidas pela regra padrão de gênero/número do
 * Português: "na" pra feminino singular, "no" pra masculino, "nos"
 * pra plural. Bangladesh/Catar costumam ser tratados sem artigo,
 * por isso "em" — soa natural em "está em Daca, em Bangladesh." */
const COUNTRY_DISPLAY: Record<Country, string> = {
  BR: 'no Brasil',
  PT: 'em Portugal',
  PY: 'no Paraguai',
  CL: 'no Chile',
  UK: 'no Reino Unido',
  DE: 'na Alemanha',
  IT: 'na Itália',
  FR: 'na França',
  ES: 'na Espanha',
  CN: 'na China',
  AU: 'na Austrália',
  RU: 'na Rússia',
  BD: 'em Bangladesh',
  TH: 'na Tailândia',
  CD: 'no Congo',
  SD: 'no Sudão',
  IQ: 'no Iraque',
  ZA: 'na África do Sul',
  AF: 'no Afeganistão',
  NG: 'na Nigéria',
  EC: 'no Equador',
  CO: 'na Colômbia',
  VE: 'na Venezuela',
  US: 'nos Estados Unidos',
  IE: 'na Irlanda',
};

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
  country: Country;
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

/* Quantos passos discretos compõem o LineString animado. Mais
 * passos = curva mais suave durante o trace. 80 é mais que
 * suficiente pra distâncias intercontinentais sem sobrecarregar
 * o setData() do source a cada frame. */
const LINE_TRACE_STEPS = 80;
/* Duração do trace progressivo da linha (user → match). */
const LINE_TRACE_DURATION_MS = 1600;

/* Interpolação linear simples entre dois lng/lat. Pra distâncias
 * intercontinentais um great-circle daria curva mais elegante,
 * mas o efeito visual com linha tracejada cinza claro num mapa
 * plano-Mercator já lê bem como "rota". */
function interpolateLngLat(
  a: [number, number],
  b: [number, number],
  t: number,
): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export default function FindMyLoveOverlay({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('searching');
  const [phraseIdx, setPhraseIdx] = useState(0);
  const isMobile = useIsMobile();
  const matchRef = useRef<MatchInfo | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  /* rAF id do trace da linha. Mantido em ref pra que o cleanup
   * do useEffect possa cancelar caso o overlay seja fechado no
   * meio da animação. */
  const lineRafRef = useRef<number | null>(null);

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

    /* ╔══════════════════════════════════════════════════════════╗
     * ║  MOBILE: zoom out no máximo (0.5 — Globe.minZoom) + pan/  ║
     * ║  rotate na visão de planeta. NÃO desenha trace nem        ║
     * ║  marker do match (ficam abaixo do gate z 2.5 mesmo).      ║
     * ║  O card centralizado já comunica a informação do match.   ║
     * ║  Per feedback "No mobile, quando o mapa for animado para  ║
     * ║  encontrar o match, faça com que ele vá para o zoom out   ║
     * ║  no máximo e se movimente nessa posição".                 ║
     * ╚══════════════════════════════════════════════════════════╝ */
    if (isMobile) {
      // Stage 1: zoom out total + leve giro + pitch (1500ms)
      map.easeTo({
        zoom: 0.5,
        bearing: 50,
        pitch: 30,
        duration: 1500,
        essential: true,
      });

      // Stage 2: continua girando + pan suave em direção ao match
      // (mantém zoom 0.5 — fica no "planeta inteiro"), 1800ms.
      const tMobile = window.setTimeout(() => {
        map.easeTo({
          center: match.center,
          zoom: 0.5,
          bearing: -20,
          pitch: 15,
          duration: 1800,
          essential: true,
        });
      }, 1600);

      // Stage 3: vai direto pra MATCHED após a animação (3400ms
      // depois do início, igual ao desktop). Sem trace de linha
      // porque o LAYER_LINE tem minzoom 2.5 e estamos em z 0.5.
      const tMatchedMobile = window.setTimeout(() => {
        setPhase('matched');
      }, 3500);

      return () => {
        window.clearTimeout(tMobile);
        window.clearTimeout(tMatchedMobile);
      };
    }

    /* ╔══════════════════════════════════════════════════════════╗
     * ║  DESKTOP: fluxo original em 3 stages (zoom-out + giro,    ║
     * ║  pan pro midpoint user↔match, trace progressivo).         ║
     * ╚══════════════════════════════════════════════════════════╝ */

    // Stage 1: zoom out + bearing rotation (1.5s)
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
      // Distância determina zoom: cidades muito distantes precisam zoom out maior.
      // CLAMP em 2.5: abaixo disso a linha (minzoom 2.5) some.
      const dx = Math.abs(USER_ORIGIN[0] - match.center[0]);
      const dy = Math.abs(USER_ORIGIN[1] - match.center[1]);
      const dist = Math.max(dx, dy);
      const targetZoom = dist > 90 ? 2.5 : dist > 50 ? 2.6 : 2.8;

      map.easeTo({
        center: [midLng, midLat],
        zoom: targetZoom,
        bearing: 0,
        pitch: 0,
        duration: 1800,
        essential: true,
      });
    }, 1600);

    // Stage 3 (after 3.4s): traça progressivamente a linha
    // do user até o match, e ao chegar revela o avatar do match.
    const t2 = window.setTimeout(() => {
      /* Inicializa o source com apenas o ponto de origem. O rAF
       * abaixo vai acrescentando pontos interpolados até alcançar
       * match.center — efeito de "rota sendo desenhada". */
      if (!map.getSource(SRC_LINE)) {
        map.addSource(SRC_LINE, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [USER_ORIGIN],
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
           * oculte os elementos plotados no mapa". O Stage 2 acima
           * clamp targetZoom em ≥ 2.5 pra garantir que o trace
           * apareça no mobile. */
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

      // Marker pin no user (origem) — aparece já no início do trace
      const userEl = document.createElement('div');
      userEl.className = `${styles.endpoint} ${styles.userEndpoint}`;
      userMarkerRef.current = new mapboxgl.Marker({ element: userEl, anchor: 'center' })
        .setLngLat(USER_ORIGIN)
        .addTo(map);

      /* Hide markers em z<2.5 per feedback "oculte elementos
       * plotados no mapa abaixo de 2.5". Definido aqui pra ser
       * reutilizado no final do trace (após o match marker
       * aparecer). */
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

      /* Anima a linha crescendo em rAF. setData() é o caminho
       * idiomático no Mapbox pra geometrias dinâmicas — substitui
       * o GeoJSON inteiro do source a cada frame, e o renderer
       * cuida do diff. */
      const startTs = performance.now();
      const tickTrace = (now: number) => {
        const elapsed = now - startTs;
        const t = Math.min(1, elapsed / LINE_TRACE_DURATION_MS);
        // ease-out quad — começa rápido, desacelera no fim
        const eased = 1 - Math.pow(1 - t, 2);

        const upTo = Math.max(1, Math.floor(eased * LINE_TRACE_STEPS));
        const coords: [number, number][] = [USER_ORIGIN];
        for (let i = 1; i <= upTo; i++) {
          coords.push(interpolateLngLat(USER_ORIGIN, match.center, i / LINE_TRACE_STEPS));
        }

        const src = map.getSource(SRC_LINE) as mapboxgl.GeoJSONSource | undefined;
        try {
          src?.setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
            properties: {},
          });
        } catch { /* map descartado mid-frame */ }

        if (t < 1) {
          lineRafRef.current = requestAnimationFrame(tickTrace);
        } else {
          // Trace concluído — pin do match (avatar + badge de
          // afinidade) surge na ponta.
          lineRafRef.current = null;
          /* Pin = wrapper flex column-reverse com:
           *   [badge "X% afinidade"]  ← acima
           *   [avatar circular]       ← anchor: 'center' do Mapbox
           * Estrutura DOM em vez de innerHTML pra evitar XSS via
           * match.affinity (mesmo sendo gerado client-side, mantém
           * o padrão seguro). */
          const pin = document.createElement('div');
          pin.className = styles.matchPin;

          const badge = document.createElement('div');
          badge.className = styles.matchAffinityBadge;
          badge.textContent = `${match.affinity}% afinidade`;

          const avatar = document.createElement('div');
          avatar.className = styles.matchAvatar;
          avatar.style.backgroundImage = `url('https://i.pravatar.cc/100?img=${match.picId}')`;

          pin.appendChild(badge);
          pin.appendChild(avatar);

          markerRef.current = new mapboxgl.Marker({ element: pin, anchor: 'center' })
            .setLngLat(match.center)
            .addTo(map);
          applyMarkerVisibility();
          setPhase('matched');
        }
      };
      lineRafRef.current = requestAnimationFrame(tickTrace);
    }, 3400);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      /* Aborta o trace se a phase mudar antes de completar
       * (ex.: user fecha o overlay mid-animation). */
      if (lineRafRef.current !== null) {
        cancelAnimationFrame(lineRafRef.current);
        lineRafRef.current = null;
      }
    };
  }, [phase, match, isMobile]);

  // Cleanup ao fechar
  useEffect(() => {
    return () => {
      if (lineRafRef.current !== null) {
        cancelAnimationFrame(lineRafRef.current);
        lineRafRef.current = null;
      }
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
    <div
      className={`${styles.overlay} ${phase === 'searching' ? styles.overlayLifted : ''}`}
      role="dialog"
      aria-modal="true"
    >
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

      {/* MATCHED: card CENTRALIZADO com info de afinidade musical.
       * Per feedback "deixe o card menor na largura, com a frase:
       * Sua afinidade musical está em Dublin, na Irlanda; na linha
       * de baixo: Vocês são superfãs de Ana Castela e adoram o
       * álbum Lets Go Rodeo!". A pílula "X% afinidade" segue no
       * pin do mapa (não duplica no card). */}
      {phase === 'matched' && (
        <div className={styles.matchCard}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.pravatar.cc/120?img=${match.picId}`}
            alt={match.name}
            className={styles.matchCardAvatar}
          />
          <div className={styles.matchCardName}>{match.name}</div>

          <div className={styles.matchAffinityCopy}>
            <p>
              Sua afinidade musical está em {match.city}, {COUNTRY_DISPLAY[match.country]}.
            </p>
            <p>
              Vocês são superfãs de Ana Castela e adoram o álbum{' '}
              <strong>Let&apos;s Go Rodeo!</strong>
            </p>
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
