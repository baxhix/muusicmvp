'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './AudioPost.module.css';

export interface AudioPostProps {
  /** URL do áudio. Com src, o card toca de verdade e a animação segue o
   *  tempo real do áudio. Sem src, roda em modo demo (progresso simulado
   *  pela duração informada) — usado pelos cards estáticos do feed. */
  src?: string;
  title?: string;
  caption?: string;
  avatar?: string;
  /** Duração em segundos — usada no modo demo e como fallback antes do
   *  metadata do áudio carregar. */
  durationSec?: number;
  /** Perfil do waveform (alturas relativas 0..1). Determinístico — NÃO é
   *  random: representa a silhueta do áudio. */
  peaks?: number[];
}

/* Silhueta padrão do waveform (alturas relativas 0..1). Estável entre
 * renders — a animação de "tocar" vem do preenchimento por tempo real,
 * não de pulsar todas as barras aleatoriamente. */
const DEFAULT_PEAKS = [
  0.22, 0.4, 0.65, 0.5, 0.8, 0.95, 0.6, 0.35, 0.5, 0.72,
  0.9, 0.55, 0.3, 0.45, 0.7, 1, 0.62, 0.4, 0.25, 0.55,
  0.82, 0.6, 0.38, 0.5, 0.74, 0.92, 0.48, 0.3, 0.58, 0.8,
  0.66, 0.42, 0.28, 0.5, 0.7, 0.45,
];

function fmt(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPost({
  src,
  title = 'Áudio da Ana',
  caption,
  avatar = '/ana-castela.png',
  durationSec = 214,
  peaks,
}: AudioPostProps) {
  const bars = peaks && peaks.length ? peaks : DEFAULT_PEAKS;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(durationSec);

  const progress = total > 0 ? Math.min(1, current / total) : 0;
  const playedCount = Math.round(progress * bars.length);

  /* Modo demo (sem src): avança o tempo via rAF enquanto "toca", limitado
   * pela duração — assim o waveform preenche de forma coerente com a
   * duração mesmo sem arquivo real. Com src, o <audio> dita o tempo. */
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

  return (
    <div className={styles.card}>
      {src && (
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
      )}

      {/* Header — avatar + tag "ÁUDIO DA ANA" + título. Distinto dos
          demais cards (que abrem com mídia/imagem). */}
      <div className={styles.head}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatar} alt={title} className={styles.avatar} />
        <div className={styles.headText}>
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            Áudio da Ana
          </span>
          <span className={styles.title}>{title}</span>
        </div>
      </div>

      {caption && <p className={styles.caption}>{caption}</p>}

      {/* Player — botão grande gradiente + waveform de progresso + tempo. */}
      <div className={styles.player}>
        <button
          className={styles.playBtn}
          onClick={toggle}
          aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
        >
          {playing ? (
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <rect x="3" y="2" width="3.5" height="12" rx="1.2" />
              <rect x="9.5" y="2" width="3.5" height="12" rx="1.2" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M4 2.5l10 5.5-10 5.5V2.5z" />
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
                style={{ height: `${Math.max(14, Math.round(h * 100))}%` }}
              />
            );
          })}
        </div>

        <span className={styles.time}>
          {fmt(current)} / {fmt(total)}
        </span>
      </div>
    </div>
  );
}
