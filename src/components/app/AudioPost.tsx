'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { awardPoints } from '@/lib/rewards';
import CommentsPanel from './CommentsPanel';
import styles from './AudioPost.module.css';
import mediaStyles from './MediaPost.module.css';

export interface AudioPostProps {
  /** URL do áudio. Default = clipe da Ana em /public. */
  src?: string;
  title?: string;
  avatar?: string;
  /** Fallback de duração (modo demo, antes do metadata carregar). */
  durationSec?: number;
  /** Silhueta do waveform (alturas relativas 0..1). Determinístico. */
  peaks?: number[];
  likes?: number;
  comments?: number;
}

/* Barras finas estilo WhatsApp/Telegram — largura fixa pequena,
 * waveform compacta (não preenche a linha toda). */
const DEFAULT_PEAKS = [
  0.35, 0.55, 0.75, 0.5, 0.85, 0.95, 0.6, 0.4, 0.55, 0.8,
  0.9, 0.5, 0.32, 0.5, 0.72, 1, 0.6, 0.42, 0.3, 0.58,
  0.82, 0.6, 0.4, 0.52, 0.76, 0.9, 0.5, 0.34, 0.6, 0.8,
  0.55, 0.38, 0.62, 0.85, 0.5, 0.3, 0.55, 0.75, 0.45, 0.6,
];

/* ── Icons (mesmos dos demais posts, ver MediaPost.tsx) ── */
const HeartIcon = () => (
  <svg viewBox="140 130 570 315" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M471.813,165.406c6.608,0,11.981,2.786,17.035,8.503l2.089,2.363l3.185,4.189l12.087,19.131
      c9.811,15.53,18.336,31.685,26.555,48.285l5.09,11.471c4.605,10.379,6.764,21.505,7.54,33.073l0.41,6.116l0.315,5.843l0.281,7.265
      l0.372,10.853l0.189,29.192c1.35,7.854,6.573,12.941,13.637,13.689c0.515,0.044,1.032,0.065,1.55,0.065
      c10.838,0,22.242-9.285,30.316-17.307l4.684-5.264l6.594-7.399l11.771-10.891l12.778-11.687c5.813-5.317,12.531-7.682,19.798-7.682
      c1.065,0,2.142,0.051,3.23,0.151c12.916,1.184,27.426,4.26,32.396,18.957c0.951,2.811,1.068,6.073,1.272,9.052l0.307,4.473
      l0.23,5.068l0.286,4.713l-0.072,38.611l-0.393,8.596c-0.38,8.308-7.694,13.145-14.813,13.274l-12.703,0.232l-2.82,0.289
      l-27.738,5.066c-28.356,5.844-56.578,10.17-85.176,12.697l-4.881,0.431l-4.49,0.373l-5.206,0.397l-5.512,0.391l-6.242,0.386
      l-5.384,0.317l-7.332,0.372l-9.633,0.397l-12.9,0.413l-58.453-0.007l-14.286-0.406l-11.021-0.397l-9.082-0.373l-8.592-0.408
      l-7.327-0.368l-5.729-0.323l-6.931-0.391l-6.235-0.375l-6.241-0.393l-5.889-0.384l-5.871-0.403l-4.849-0.381l-4.344-0.374
      l-4.667-0.402l-4.506-0.388l-4.505-0.387l-4.504-0.383l-4.85-0.406l-4.506-0.376l-4.85-0.403l-4.506-0.374l-4.85-0.402l-4.506-0.374
      l-4.851-0.403l-4.505-0.381l-4.505-0.389l-4.508-0.389l-4.157-0.378l-4.162-0.395l-3.814-0.371l-4.101-0.425l-13.722-1.657
      c-11.055-1.335-21.843-3.237-32.585-6.631c-7.188-2.272-14.019-3.972-21.455-4.64l-4.168-0.374
      c-3.638-0.327-7.086-0.531-10.672-1.725c-3.078-1.025-6.093-4.261-6.095-8.278l-0.035-65.23c-0.002-4.03,3.294-8.89,5.932-12.027
      c3.289-3.911,6.916-6.883,11.399-9.038c4.449-2.138,9.229-3.55,14.152-3.848l3.514-0.213l3.116,0.182
      c5.166,0.301,9.982,2.106,14.269,5.41c7.327,5.648,14.006,11.753,20.714,18.326l21.264,20.837c3.456,3.387,7.397,5.769,11.428,8.199
      c6.216,3.747,15.256,7.616,22.494,7.616c1.103,0,2.164-0.09,3.167-0.284c3.748-0.725,6.579-3.671,7.405-7.615
      c0.625-2.983,0.238-5.7,0.216-8.673l-0.232-30.538l-0.248-3.926l-0.264-4.674l-0.339-5.06l-0.348-5.448l0.035-9.618
      c0.957-12.815,6.523-24.79,12.583-35.624l9.761-17.451l13.81-22.227l18.681-30.327l7.984-11.66c2.755-4.023,7.547-5.35,12.279-5.35
      c1.289,0,2.572,0.098,3.81,0.267c8.413,1.15,16.579,4.202,23.193,10.207l5.998,6.455c2.573,2.77,6.134,4.169,9.728,4.169
      c2.472,0,4.96-0.662,7.153-1.996c1.488-0.906,3.094-1.285,4.719-1.285c1.713,0,3.448,0.421,5.094,1.092
      c2.465,1.005,4.751,1.807,6.81,1.807c2.25,0,4.228-0.958,5.874-3.659c0.916-1.503,2.08-3.174,3.281-4.392
      c6.957-7.062,13.972-11.901,23.517-13.276C469.336,165.5,470.596,165.406,471.813,165.406z"/>
  </svg>
);
const CommentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

export default function AudioPost({
  src = '/audio-ana-castela.mp3',
  title = 'Áudio da Ana!',
  avatar = '/ana-castela.png',
  durationSec = 30,
  peaks,
  likes = 1280,
  comments = 86,
}: AudioPostProps) {
  const bars = peaks && peaks.length ? peaks : DEFAULT_PEAKS;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(durationSec);

  // Likes + comments — mesmo fluxo dos demais posts (ver MediaPost).
  const [liked, setLiked] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(comments);

  const postKey = `media:audio:${src}`;

  const progress = total > 0 ? Math.min(1, current / total) : 0;
  const playedCount = Math.round(progress * bars.length);

  useEffect(() => {
    if (src || !playing) return;
    lastTsRef.current = 0;
    const tick = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setCurrent((c) => {
        const next = c + dt;
        if (next >= total) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafRef.current);
  }, [playing, src, total]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (src && el) {
      if (el.paused) {
        el.play()
          .then(() => setPlaying(true))
          .catch(() => setPlaying(false));
      } else {
        el.pause();
        setPlaying(false);
      }
    } else {
      setPlaying((p) => !p);
    }
  }, [src]);

  const seekTo = useCallback(
    (fraction: number) => {
      const f = Math.max(0, Math.min(1, fraction));
      const el = audioRef.current;
      if (src && el && Number.isFinite(el.duration)) {
        el.currentTime = f * el.duration;
        setCurrent(el.currentTime);
      } else {
        setCurrent(f * total);
      }
    },
    [src, total],
  );

  const likeTotal = likes + (liked ? 1 : 0);

  return (
    <div className={styles.card}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setTotal(d);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
      />

      {/* Linha única: avatar GRANDE à esquerda + (título sobre a
       *  waveform, empilhados) logo à frente → card mais baixo. */}
      <div className={styles.row}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatar} alt="" className={styles.avatar} />
        <div className={styles.col}>
          <span className={styles.title}>{title}</span>

          {/* Player: play (verde) + waveform fina lilás. */}
          <div className={styles.player}>
            <button
              type="button"
              className={styles.playBtn}
              onClick={toggle}
              aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
            >
              {playing ? (
                <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
                  <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M4.5 3l8 5-8 5V3z" />
                </svg>
              )}
            </button>

            <div
              className={`${styles.waveform} ${playing ? styles.waveformPlaying : ''}`}
              role="slider"
              aria-label="Progresso do áudio"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              tabIndex={0}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                seekTo((e.clientX - rect.left) / rect.width);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') seekTo(progress + 0.05);
                else if (e.key === 'ArrowLeft') seekTo(progress - 0.05);
              }}
            >
              {bars.map((h, i) => {
                const played = i < playedCount;
                const atHead = playing && i === playedCount;
                return (
                  <span
                    key={i}
                    className={`${styles.bar} ${played ? styles.barPlayed : ''} ${
                      atHead ? styles.barHead : ''
                    }`}
                    style={{ height: `${Math.max(22, Math.round(h * 100))}%` }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Ações — idênticas aos demais posts (curtir + comentar + enviar). */}
      <div className={mediaStyles.actions}>
        <button
          className={`${mediaStyles.btn} ${mediaStyles.btnHat} ${liked ? mediaStyles.btnLiked : ''}`}
          onClick={() => {
            const next = !liked;
            setLiked(next);
            track(next ? 'feed_post_liked' : 'feed_post_unliked', {
              post_key: postKey,
              creator_name: 'Ana Castela',
            });
            if (next) {
              void awardPoints('like', {
                apiPath: `/api/feed/posts/${encodeURIComponent(postKey)}/like`,
                analyticsContext: { post_key: postKey },
              });
            }
          }}
          aria-label="Like"
        >
          <HeartIcon />
          {likeTotal > 0 ? likeTotal : null}
        </button>

        <button
          className={`${mediaStyles.btn} ${commentsOpen ? mediaStyles.btnLiked : ''}`}
          onClick={() => setCommentsOpen((v) => !v)}
          aria-label={commentsOpen ? 'Fechar comentários' : 'Comentar'}
          aria-expanded={commentsOpen}
        >
          <CommentIcon />
          {commentCount > 0 ? commentCount : null}
        </button>

        <div className={mediaStyles.spacer} />

        <button
          className={mediaStyles.btn}
          onClick={() => {
            void awardPoints('send', {
              apiPath: `/api/feed/posts/${encodeURIComponent(postKey)}/share`,
              analyticsContext: { post_key: postKey },
            });
          }}
          aria-label="Enviar mensagem"
        >
          <SendIcon />
          <span style={{ visibility: 'hidden', fontSize: '11px' }}>0</span>
        </button>
      </div>

      <CommentsPanel
        postKey={postKey}
        initialCommentCount={comments}
        open={commentsOpen}
        onCountChange={setCommentCount}
      />
    </div>
  );
}
