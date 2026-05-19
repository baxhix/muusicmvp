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
  /** Pixel size of the heart. */
  size: number;
  /** Delay before this heart starts falling (ms). */
  delay: number;
  /** Total duration of the fall (ms). */
  duration: number;
  /** Drift rotation degrees during the fall. */
  drift: number;
}

/* Hearts are now rendered as a single FLAT SVG shape filled
 * with one brand-red color (#ef4444) per product feedback —
 * the previous mix of emoji variants picked up the system
 * font's glossy / multi-tone rendering which conflicted with
 * the "flat single-color" brief.
 *
 * Batch count cut roughly in half (14 → 8) so the cascade
 * feels lighter and more elegant rather than a downpour. */
const PARTICLES_PER_BATCH = 8;
const CLEANUP_BUFFER_MS = 200;

function buildBatch(batchId: number): HeartParticle[] {
  const out: HeartParticle[] = [];
  for (let i = 0; i < PARTICLES_PER_BATCH; i++) {
    out.push({
      id: `${batchId}-${i}`,
      xPercent: 8 + Math.random() * 84,
      size: 24 + Math.random() * 14, // 24-38px
      delay: Math.random() * 1400,
      duration: 2800 + Math.random() * 1200, // 2.8-4.0s
      drift: -22 + Math.random() * 44, // ±22deg drift
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
          <svg
            key={p.id}
            viewBox="0 0 24 24"
            className={styles.heart}
            style={
              {
                left: `${p.xPercent}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                animationDelay: `${p.delay}ms`,
                animationDuration: `${p.duration}ms`,
                ['--heart-drift' as string]: `${p.drift}deg`,
              } as React.CSSProperties
            }
            aria-hidden="true"
          >
            {/* Flat solid heart shape — single-color fill so the
              * cascade reads as a clean graphic motif instead of
              * relying on the system font's glossy emoji
              * rendering. */}
            <path
              d="M12 21s-7-4.35-9.5-9.5C1 8 3.5 4.5 7 4.5c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 3.5 0 6 3.5 4.5 7-2.5 5.15-9.5 9.5-9.5 9.5z"
              fill="#ef4444"
            />
          </svg>
        )),
      )}
    </div>
  );
}
