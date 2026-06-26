'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './AudioPost.module.css';

export interface AudioPostProps {
  /** URL do áudio. Default = clipe da Ana em /public. */
  src?: string;
  title?: string;
  avatar?: string;
  /** Fallback de duração (modo demo, antes do metadata carregar). */
  durationSec?: number;
  /** Silhueta do waveform (alturas relativas 0..1). Determinístico. */
  peaks?: number[];
}

/* Mais barras → cada barra (flex:1) fica mais fina. */
const DEFAULT_PEAKS = [
  0.3, 0.5, 0.7, 0.55, 0.85, 0.95, 0.6, 0.4, 0.55, 0.78,
  0.9, 0.5, 0.32, 0.5, 0.72, 1, 0.6, 0.42, 0.3, 0.58,
  0.82, 0.6, 0.4, 0.52, 0.76, 0.9, 0.5, 0.34, 0.6, 0.8,
  0.55, 0.38, 0.62, 0.85, 0.5, 0.3, 0.55, 0.75, 0.45, 0.6,
  0.82, 0.5, 0.36, 0.58, 0.7, 0.44, 0.6, 0.4,
];

export default function AudioPost({
  src = '/audio-ana-castela.mp3',
  title = 'Áudio da Ana!',
  avatar = '/ana-castela.png',
  durationSec = 30,
  peaks,
}: AudioPostProps) {
  const bars = peaks && peaks.length ? peaks : DEFAULT_PEAKS;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(durationSec);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(1280);

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

  function toggleLike() {
    setLikeCount((c) => c + (liked ? -1 : 1));
    setLiked((v) => !v);
  }

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

      {/* Cabeçalho: imagem da Ana + título ACIMA das barras. */}
      <div className={styles.head}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatar} alt="" className={styles.avatar} />
        <span className={styles.title}>{title}</span>
      </div>

      {/* Player: botão de play no INÍCIO das barras + waveform. */}
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
                style={{ height: `${Math.max(18, Math.round(h * 100))}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Ações — curtir + comentar. */}
      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.action} ${liked ? styles.actionLiked : ''}`}
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label="Curtir"
        >
          <svg viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
          <span className={styles.actionCount}>{likeCount.toLocaleString('pt-BR')}</span>
        </button>

        <button type="button" className={styles.action} aria-label="Comentar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-5.6a8.4 8.4 0 0 1-.9-3.9A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z" />
          </svg>
          <span className={styles.actionCount}>86</span>
        </button>
      </div>
    </div>
  );
}
