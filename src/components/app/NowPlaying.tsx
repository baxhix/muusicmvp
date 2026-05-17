'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { useSpotifyNowPlaying } from '@/hooks/useSpotifyNowPlaying';
import { useListeningTracker } from '@/hooks/useListeningTracker';
import { startSpotifyLogin, disconnectSpotify } from '@/lib/spotify';
import { useTracksCatalog } from '@/hooks/useTracksCatalog';
import type { CatalogTrack } from '@/data/tracksCatalog';
import styles from './NowPlaying.module.css';

/**
 * Derived player song — adds the YouTube thumbnail used as cover art.
 * No longer a module-level const: the playlist is now fetched at
 * runtime via useTracksCatalog so admin additions reflect inside
 * the platform without a redeploy.
 */
export interface PlayerSong extends CatalogTrack {
  img: string;
}

function withCover(t: CatalogTrack): PlayerSong {
  return { ...t, img: `https://i.ytimg.com/vi/${t.youtubeId}/hqdefault.jpg` };
}

const SONG_INTERVAL_MS = 8500;
const FALLBACK_IMG = '/ana-castela-box.jpg';

export type PlayerSize = 'mini' | 'horizontal' | 'expanded' | 'video';

/**
 * Build the iframe URL for a video. `enablejsapi=1` is the magic
 * flag that makes the YouTube embed broadcast state changes via
 * postMessage — required for the autoplay-next behavior wired
 * below. Other params kill YouTube chrome (related videos, captions
 * auto-load, etc.) so the player feels like ours.
 */
function buildVideoSrc(youtubeId: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline: '1',
    cc_load_policy: '0',
    fs: '1',
    enablejsapi: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`;
}

interface NowPlayingProps {
  onExpandChange?: (expanded: boolean) => void;
  /** Notifica mudanças de tamanho do player (mini/horizontal/expanded/video) */
  onSizeChange?: (size: PlayerSize) => void;
  /** When true: renders inline (no fixed position), expansion disabled */
  embed?: boolean;
  /** Índice da música atual (controlado externamente). Default: estado interno */
  songIdx?: number;
  /** Callback pra mudar a música (controlado externamente) */
  onSongIdxChange?: (idx: number) => void;
  /** Callback pra abrir o modal da playlist */
  onOpenPlaylist?: () => void;
  /** Fired when the user drags the player horizontally past the
   *  dismiss threshold (default 80px). Wired by the shell layout
   *  to flip `playerHidden` in the AppShellProvider — the player
   *  unmounts and a small restore pill takes its place. */
  onDismiss?: () => void;
}

export default function NowPlaying({
  onExpandChange,
  onSizeChange,
  embed = false,
  songIdx: songIdxProp,
  onSongIdxChange,
  onOpenPlaylist,
  onDismiss,
}: NowPlayingProps) {
  // Default to the compact `mini` state — Spotify-style pill that
  // shows cover + title + play without competing with the map for
  // bottom-left screen real estate. The user can cycle up to
  // horizontal → expanded → video by clicking the pill (see
  // handleClick below). Was 'video' previously; product feedback
  // asked for a slim resting state so the globe stays readable.
  const [size, setSize] = useState<PlayerSize>('mini');
  const expanded = size === 'expanded';
  const isHorizontal = size === 'horizontal';
  const isMini = size === 'mini';
  const isVideo = size === 'video';
  const [videoStarted, setVideoStarted] = useState(false);

  // Live playlist — seeded from the static catalog, replaced by the
  // /api/tracks response on mount. useMemo stabilises identity so
  // downstream useEffect deps don't churn on every render.
  const { tracks: catalog } = useTracksCatalog();
  const SONGS: PlayerSong[] = useMemo(() => catalog.map(withCover), [catalog]);

  // Ref to the YouTube iframe so we can postMessage / subscribe to
  // its state events for autoplay-next on song-end.
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Reset videoStarted ao sair do estado video
  useEffect(() => {
    if (!isVideo) setVideoStarted(false);
  }, [isVideo]);

  // songIdx pode vir do parent (controlado) ou do estado interno (fallback)
  const [internalSongIdx, setInternalSongIdx] = useState(0);
  const songIdx = songIdxProp ?? internalSongIdx;
  const setSongIdx = useCallback(
    (updater: number | ((prev: number) => number)) => {
      const next = typeof updater === 'function' ? updater(songIdx) : updater;
      if (onSongIdxChange) onSongIdxChange(next);
      else setInternalSongIdx(next);
    },
    [songIdx, onSongIdxChange]
  );
  const { isPlaying, togglePlay, progressPercent, formattedCurrent, formattedTotal, progressSecs } =
    useNowPlaying(64, 204);

  // Reports listening activity to the realtime server. Server upserts
  // now_playing + appends to listening_history; same_track notifications
  // fire automatically on track change.
  useListeningTracker({
    youtubeId: SONGS[songIdx]?.youtubeId ?? null,
    positionSeconds: progressSecs,
    isPaused: !isPlaying,
  });

  // Notifica os callbacks ao montar com o tamanho inicial (default = video)
  useEffect(() => {
    if (embed) return;
    onSizeChange?.(size);
    onExpandChange?.(size === 'expanded' || size === 'video');
    // só roda no mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Spotify (real) — se conectado, sobrescreve o mock
  const { track: spotifyTrack, connected: spotifyConnected } = useSpotifyNowPlaying();
  const useSpotifyData = spotifyConnected && spotifyTrack !== null;

  // Rotação automática só quando NÃO está usando Spotify real
  // (pausa também no estado expanded e video — a música/clipe fica no controle do usuário)
  useEffect(() => {
    if (useSpotifyData || !isPlaying || expanded || isVideo) return;
    const id = setInterval(() => {
      setSongIdx((i) => (i + 1) % SONGS.length);
    }, SONG_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, expanded, isVideo, useSpotifyData]);

  // Deps include SONGS.length so the wraparound math stays in sync
  // when admin adds tracks at runtime (catalog grows beyond what the
  // initial render captured).
  const goNext = useCallback(() => {
    setSongIdx((i) => (i + 1) % SONGS.length);
  }, [SONGS.length, setSongIdx]);

  const goPrev = useCallback(() => {
    setSongIdx((i) => (i - 1 + SONGS.length) % SONGS.length);
  }, [SONGS.length, setSongIdx]);

  // ── Continuous autoplay ────────────────────────────────────────
  // After the user manually starts the first video (browser autoplay
  // policy gate satisfied via the videoPoster click), we subscribe
  // to the YouTube iframe's state-change events. When a track hits
  // ENDED (playerState 0), we advance to the next song so the
  // session keeps going hands-free — each new track triggers a fresh
  // listening:tick on the server, which is what the admin panel
  // reads to attribute streams to the user.
  useEffect(() => {
    if (!isVideo || !videoStarted) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Tell the embedded player to start broadcasting events via
    // postMessage. Has to be sent AFTER the iframe loads — try once
    // immediately (in case it's already loaded from React's first
    // render) and again on the 'load' event.
    const subscribe = () => {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 'muusic-player' }),
        '*',
      );
    };
    subscribe();
    iframe.addEventListener('load', subscribe);

    const onMessage = (e: MessageEvent) => {
      // Origin check — YouTube can serve from either host depending
      // on the embed flavor.
      if (
        !e.origin.endsWith('youtube-nocookie.com') &&
        !e.origin.endsWith('youtube.com')
      ) {
        return;
      }
      let data: unknown;
      try {
        data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      const payload = data as {
        event?: string;
        info?: { playerState?: number };
      };
      // PlayerState 0 = ENDED in the YouTube IFrame Player API.
      if (
        payload?.event === 'infoDelivery' &&
        payload.info?.playerState === 0
      ) {
        goNext();
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      iframe.removeEventListener('load', subscribe);
    };
  }, [isVideo, videoStarted, songIdx, goNext]);

  // Música atual: Spotify real OU mock rotacionando
  const song = useSpotifyData
    ? { title: spotifyTrack.title, artist: spotifyTrack.artist, img: spotifyTrack.img }
    : SONGS[songIdx];

  // ── Click + drag-to-dismiss ──
  //
  // The player root is both clickable (taps cycle size:
  // mini → horizontal → expanded → video → mini) AND draggable
  // (horizontal swipe past the dismiss threshold hides the
  // player via `onDismiss`). We unify the two gestures in a
  // single pointer-event-based state machine so they never
  // race each other.
  //
  // Rules:
  //   - movement under 5px → tap (cycle size)
  //   - horizontal movement over 80px → dismiss
  //   - vertical movement or in-between → snap back
  //   - clicks inside <button>/iframe/.video-shell ignored
  //     (play, prev/next, video iframe own their own gestures)
  const CLICK_THRESHOLD_PX = 5;
  const DISMISS_THRESHOLD_PX = 80;
  const dragStartRef = useRef<{
    x: number;
    y: number;
    onControl: boolean;
  } | null>(null);
  const [dragX, setDragX] = useState(0);
  // Separate "finger is down + moving" from "drag delta is non-zero":
  //   - During active drag → no CSS transition (1:1 finger tracking).
  //   - On release → transition kicks in so snap-back / dismiss
  //     animate smoothly to their target.
  const [isPointerDown, setIsPointerDown] = useState(false);

  const cycleSize = useCallback(() => {
    setSize((curr) => {
      const next: PlayerSize =
        curr === 'mini'
          ? 'horizontal'
          : curr === 'horizontal'
            ? 'expanded'
            : curr === 'expanded'
              ? 'video'
              : 'mini';
      onExpandChange?.(next === 'expanded' || next === 'video');
      onSizeChange?.(next);
      return next;
    });
  }, [onExpandChange, onSizeChange]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (embed) return;
      const target = e.target as HTMLElement;
      const onControl = !!target.closest('button, iframe, .video-shell');
      dragStartRef.current = { x: e.clientX, y: e.clientY, onControl };
      setIsPointerDown(true);
      // Capture so subsequent move/up events fire on this element
      // even if the pointer wanders off (e.g. a fast swipe leaves
      // the player's box before release).
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [embed],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const start = dragStartRef.current;
    if (!start || start.onControl) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    // Only enter "drag mode" once horizontal motion exceeds
    // vertical (otherwise the gesture is a scroll attempt, not
    // a dismiss). Above CLICK_THRESHOLD_PX so we're past the
    // click no-op window.
    if (Math.abs(dx) > CLICK_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      setDragX(dx);
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      dragStartRef.current = null;
      setIsPointerDown(false);
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const horizontal = Math.abs(dx);
      const vertical = Math.abs(dy);

      // 1) Click — no real motion, no inner control.
      if (horizontal < CLICK_THRESHOLD_PX && vertical < CLICK_THRESHOLD_PX) {
        if (!start.onControl) cycleSize();
        return;
      }
      // 2) Dismiss — clear horizontal swipe past threshold.
      if (horizontal > DISMISS_THRESHOLD_PX && horizontal > vertical) {
        // Animate the rest of the way out before unmounting.
        const dir = dx < 0 ? -1 : 1;
        setDragX(dir * 400);
        // Tiny delay so the slide-out paints before the parent
        // removes the player from the tree.
        setTimeout(() => {
          setDragX(0);
          onDismiss?.();
        }, 180);
        return;
      }
      // 3) Snap back — anything else (vertical scroll attempt,
      //    too short a horizontal drag). Setting dragX=0 with
      //    isPointerDown=false enables the snap-back transition.
      setDragX(0);
    },
    [cycleSize, onDismiss],
  );

  const handlePointerCancel = useCallback(() => {
    dragStartRef.current = null;
    setIsPointerDown(false);
    setDragX(0);
  }, []);

  return (
    <div
      className={[
        styles.player,
        embed ? styles.playerEmbed : '',
        !embed && isMini ? styles.playerMini : '',
        !embed && isHorizontal ? styles.playerHorizontal : '',
        !embed && expanded ? styles.playerExpanded : '',
        !embed && isVideo ? styles.playerVideo : '',
      ].filter(Boolean).join(' ')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={
        embed
          ? undefined
          : {
              transform: dragX ? `translate3d(${dragX}px, 0, 0)` : undefined,
              // While the finger is down we want 1:1 finger tracking
              // (no transition). On release the transition kicks in
              // so snap-back AND slide-out-to-dismiss are smooth.
              transition: isPointerDown
                ? 'none'
                : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease',
              opacity: Math.abs(dragX) > 200 ? 0 : 1,
              // Allow vertical scroll gestures to fall through; we
              // only consume horizontal motion.
              touchAction: 'pan-y',
            }
      }
      role="region"
      aria-label="Tocando agora"
    >
      {/* Estado VIDEO — embed do YouTube ACIMA do player */}
      {isVideo && !embed && (
        <div
          className={`${styles.videoShell} video-shell`}
          onClick={(e) => e.stopPropagation()}
        >
          {!videoStarted ? (
            // Custom thumbnail + play button (substitui a tela de preview da YouTube)
            <button
              type="button"
              className={styles.videoPoster}
              onClick={(e) => { e.stopPropagation(); setVideoStarted(true); }}
              aria-label={`Tocar: ${song.title} — ${song.artist}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://i.ytimg.com/vi/${SONGS[songIdx].youtubeId}/hqdefault.jpg`}
                alt=""
                className={styles.videoPosterImg}
              />
              <span className={styles.videoPosterOverlay} aria-hidden="true" />
              <span className={styles.videoPosterPlay} aria-hidden="true">
                <svg viewBox="0 0 32 32" fill="none">
                  <path d="M11 8v16l13-8L11 8z" fill="currentColor" />
                </svg>
              </span>
            </button>
          ) : (
            <>
              <iframe
                ref={iframeRef}
                key={SONGS[songIdx].youtubeId}
                className={styles.videoIframe}
                src={buildVideoSrc(SONGS[songIdx].youtubeId)}
                title={`${song.title} — ${song.artist}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
              {/* Máscara superior — cobre título/canal/mais opções da YouTube */}
              <span className={styles.videoMaskTop} aria-hidden="true" />
              {/* Máscara inferior direita — cobre CC/configurações/qualidade */}
              <span className={styles.videoMaskBottomRight} aria-hidden="true" />
            </>
          )}
        </div>
      )}

      {/* Capa */}
      <div className={`${styles.art} ${expanded ? styles.artExpanded : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`art-${useSpotifyData ? song.title : songIdx}`}
          src={song.img}
          alt={song.title}
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== window.location.origin + FALLBACK_IMG) {
              target.src = FALLBACK_IMG;
            }
          }}
        />
        {/* Wave por cima da imagem (só no mini) */}
        {isMini && !embed && (
          <div
            className={`${styles.waveOverlay} ${!isPlaying ? styles.wavePaused : ''}`}
            aria-hidden="true"
          >
            {[...Array(4)].map((_, i) => <div key={i} className={styles.waveBar} />)}
          </div>
        )}
        {useSpotifyData && (
          <span
            className={styles.spotifyBadge}
            title="Conectado ao Spotify · clique pra desconectar"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Desconectar Spotify?')) {
                disconnectSpotify();
                window.location.reload();
              }
            }}
            aria-label="Conectado ao Spotify"
          />
        )}
      </div>

      {/* Info — title always visible. Artist + Spotify connect
       *  affordances only appear once the player grows beyond mini
       *  (so the compact pill stays Spotify-mini-bar slim). */}
      <div key={`info-${useSpotifyData ? song.title : songIdx}`} className={styles.info}>
        <div className={styles.title}>{song.title}</div>
        {(!isMini || embed) && (
          <div className={styles.artist}>
            {song.artist}
            {!embed && (
              useSpotifyData ? (
                <span className={styles.spotifyConnected}>
                  · Conectado ao Spotify
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.spotifyConnect}
                  onClick={(e) => {
                    e.stopPropagation();
                    startSpotifyLogin();
                  }}
                >
                  · Conectar Spotify
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* Estado MINI — só play/pause (wave foi pra capa) */}
      {isMini && !embed && (
        <div className={styles.miniControls}>
          <button
            className={styles.miniPlay}
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            aria-label={isPlaying ? 'Pausar' : 'Play'}
          >
            {isPlaying ? (
              <svg viewBox="0 0 14 14" fill="none">
                <rect x="3" y="2" width="2.8" height="10" rx="1" fill="currentColor"/>
                <rect x="8.2" y="2" width="2.8" height="10" rx="1" fill="currentColor"/>
              </svg>
            ) : (
              <svg viewBox="0 0 14 14" fill="none">
                <path d="M4 2.5v9L12 7 4 2.5z" fill="currentColor"/>
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Estado HORIZONTAL/VIDEO — controles inline (anterior/play/próxima) */}
      {(isHorizontal || isVideo || embed) && (
        <div className={styles.inlineControls}>
          {isPlaying && !embed && (
            <div className={styles.wave} aria-hidden="true">
              {[...Array(4)].map((_, i) => <div key={i} className={styles.waveBar} />)}
            </div>
          )}

          <button
            className={styles.miniPrev}
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="Faixa anterior"
          >
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M12 3L5 8l7 5V3z" fill="currentColor"/>
              <line x1="3" y1="3" x2="3" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>

          <button
            className={styles.miniPlay}
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            aria-label={isPlaying ? 'Pausar' : 'Play'}
          >
            {isPlaying ? (
              <svg viewBox="0 0 14 14" fill="none">
                <rect x="3" y="2" width="2.8" height="10" rx="1" fill="currentColor"/>
                <rect x="8.2" y="2" width="2.8" height="10" rx="1" fill="currentColor"/>
              </svg>
            ) : (
              <svg viewBox="0 0 14 14" fill="none">
                <path d="M4 2.5v9L12 7 4 2.5z" fill="currentColor"/>
              </svg>
            )}
          </button>

          <button
            className={styles.miniNext}
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Próxima faixa"
          >
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M4 3l7 5-7 5V3z" fill="currentColor"/>
              <line x1="13" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>

          {!embed && onOpenPlaylist && (
            <button
              className={styles.miniQueue}
              onClick={(e) => { e.stopPropagation(); onOpenPlaylist(); }}
              aria-label="Abrir playlist"
            >
              <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="5" x2="15" y2="5" />
                <line x1="3" y1="9" x2="15" y2="9" />
                <line x1="3" y1="13" x2="11" y2="13" />
                <polygon points="14 12 17 14 14 16 14 12" fill="currentColor" stroke="none"/>
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Expand: progress + controls */}
      <div className={`${styles.expand} ${expanded ? styles.expandOpen : ''}`}>
        <div>
          <div className={styles.progTrack}>
            <div className={styles.progFill} style={{ width: progressPercent }} />
          </div>
          <div className={styles.times}>
            <span>{formattedCurrent}</span>
            <span>{formattedTotal}</span>
          </div>
        </div>
        <div className={styles.controls}>
          <button className={styles.ctrlBtn} aria-label="Anterior">
            <svg viewBox="0 0 18 18" fill="none">
              <path d="M13 4L6 9l7 5V4z" fill="currentColor"/>
              <line x1="4" y1="4" x2="4" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className={`${styles.ctrlBtn} ${styles.ctrlPlay}`}
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            aria-label={isPlaying ? 'Pausar' : 'Play'}
          >
            {isPlaying ? (
              <svg viewBox="0 0 16 16" fill="none">
                <rect x="4" y="3" width="3" height="10" rx="1" fill="currentColor"/>
                <rect x="9" y="3" width="3" height="10" rx="1" fill="currentColor"/>
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M5 3.5v9L13 8 5 3.5z" fill="currentColor"/>
              </svg>
            )}
          </button>
          <button
            className={styles.ctrlBtn}
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Próximo"
          >
            <svg viewBox="0 0 18 18" fill="none">
              <path d="M5 4l7 5-7 5V4z" fill="currentColor"/>
              <line x1="14" y1="4" x2="14" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
