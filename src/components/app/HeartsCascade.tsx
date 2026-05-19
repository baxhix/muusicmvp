'use client';

import { useEffect, useState } from 'react';
import styles from './HeartsCascade.module.css';

/* ============================================================
 * HEARTS CASCADE — elegant falling-hearts overlay
 *
 * Mounted at the layout level. Listens for `app:hearts-cascade`
 * and renders ~14 heart emojis at randomized horizontal
 * positions falling from the top of the viewport with staggered
 * delays + slight rotation drift. Each batch auto-cleans after
 * its animation completes.
 *
 * Used by the MockToastRotator when the "waved" notification
 * fires — gives the wave / like action a subtle, engagement-
 * focused celebratory cue without a heavy modal celebration
 * surface. Multiple bursts can overlap (each batch tracked by
 * a unique id so cleanup doesn't clobber a fresh cascade).
 *
 * No canvas-confetti dependency — pure DOM + CSS keyframes so
 * the look is precisely the "falling hearts" the spec asks for
 * (canvas-confetti's heart shape would render as small
 * particles, less recognizable on mobile).
 * ============================================================ */

interface HeartParticle {
  /** Unique id used as React key — combines batch id + index. */
  id: string;
  /** Horizontal position as a viewport percentage (5-95). */
  xPercent: number;
  /** Pixel size of the heart emoji. */
  size: number;
  /** Delay before this heart starts falling (ms). */
  delay: number;
  /** Total duration of the fall (ms). */
  duration: number;
  /** Drift rotation degrees during the fall. */
  drift: number;
  /** Emoji to render. We mix hearts with a hand-wave so the
   *  cascade reads as a wave-and-like response rather than
   *  pure romantic hearts. */
  emoji: string;
}

/* Only solid red hearts per product feedback — the previous
 * pool mixed pink hearts (💖💗💞💕) and the waving-hand emoji
 * (👋). Reduced to two red-family variants so the cascade
 * still feels alive without leaving the red palette. */
const HEART_EMOJIS = ['❤️', '❣️'];
const PARTICLES_PER_BATCH = 14;
const CLEANUP_BUFFER_MS = 200;

/** Pseudo-random per-batch. We use Math.random() since the
 *  values are display-only (no determinism needed). */
function buildBatch(batchId: number): HeartParticle[] {
  const out: HeartParticle[] = [];
  for (let i = 0; i < PARTICLES_PER_BATCH; i++) {
    out.push({
      id: `${batchId}-${i}`,
      // Spread across the viewport with safe margins so hearts
      // don't dribble down the very edge.
      xPercent: 5 + Math.random() * 90,
      size: 22 + Math.random() * 18, // 22-40px
      delay: Math.random() * 1600, // staggered launch up to 1.6s
      duration: 2800 + Math.random() * 1400, // 2.8-4.2s fall
      drift: -28 + Math.random() * 56, // ±28deg rotation drift
      emoji:
        HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)] ??
        '❤️',
    });
  }
  return out;
}

interface Batch {
  id: number;
  particles: HeartParticle[];
}

export default function HeartsCascade() {
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    let nextBatchId = 1;
    const handler = () => {
      const id = nextBatchId++;
      const particles = buildBatch(id);
      setBatches((prev) => [...prev, { id, particles }]);

      // Worst-case lifetime: max(delay + duration) across the
      // batch + a small buffer. Conservative — use the upper
      // bounds rather than computing per-particle max.
      const lifetime = 1600 + 4200 + CLEANUP_BUFFER_MS;
      window.setTimeout(() => {
        setBatches((prev) => prev.filter((b) => b.id !== id));
      }, lifetime);
    };
    window.addEventListener('app:hearts-cascade', handler);
    return () => window.removeEventListener('app:hearts-cascade', handler);
  }, []);

  if (batches.length === 0) return null;

  return (
    <div className={styles.root} aria-hidden="true">
      {batches.flatMap((batch) =>
        batch.particles.map((p) => (
          <span
            key={p.id}
            className={styles.heart}
            style={
              {
                left: `${p.xPercent}%`,
                fontSize: `${p.size}px`,
                animationDelay: `${p.delay}ms`,
                animationDuration: `${p.duration}ms`,
                ['--heart-drift' as string]: `${p.drift}deg`,
              } as React.CSSProperties
            }
          >
            {p.emoji}
          </span>
        )),
      )}
    </div>
  );
}
