'use client';

import { useEffect, useState } from 'react';
import styles from './HeartsCascade.module.css';

/* ============================================================
 * HEARTS CASCADE — falling-emoji overlay
 *
 * Mounted at the layout level. Listens for `app:hearts-cascade`
 * and renders ~8 emoji particles at randomized horizontal
 * positions falling from the top of the viewport with staggered
 * delays + slight rotation drift. Each batch auto-cleans after
 * its animation completes.
 *
 * The event accepts an optional `detail.icon` field:
 *   - 'heart' (default) → flat red SVG heart, used by real
 *     wave-send events arriving via `useNotificationsLive`.
 *   - 'hand'           → 👋 emoji glyph, used by the
 *     MockToastRotator's "waved" rotation slot per product
 *     feedback "Nas notificação mocada que determinado usuário
 *     Acenou, use os emojis em cascata da mão e não de
 *     coração."
 *
 * Multiple bursts can overlap and CAN have different icons —
 * each batch carries its own `icon` choice so a heart cascade
 * + a hand cascade can coexist on screen.
 * ============================================================ */

type CascadeIcon = 'heart' | 'hand';

interface CascadeParticle {
  /** Unique id used as React key — combines batch id + index. */
  id: string;
  /** Horizontal position as a viewport percentage (5-95). */
  xPercent: number;
  /** Pixel size of the particle. */
  size: number;
  /** Delay before this particle starts falling (ms). */
  delay: number;
  /** Total duration of the fall (ms). */
  duration: number;
  /** Drift rotation degrees during the fall. */
  drift: number;
}

interface Batch {
  id: number;
  icon: CascadeIcon;
  particles: CascadeParticle[];
}

const PARTICLES_PER_BATCH = 8;
const CLEANUP_BUFFER_MS = 200;

function buildBatch(batchId: number): CascadeParticle[] {
  const out: CascadeParticle[] = [];
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

export default function HeartsCascade() {
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    let nextBatchId = 1;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ icon?: CascadeIcon } | undefined>)
        .detail;
      const icon: CascadeIcon = detail?.icon === 'hand' ? 'hand' : 'heart';

      const id = nextBatchId++;
      const particles = buildBatch(id);
      setBatches((prev) => [...prev, { id, icon, particles }]);

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
        batch.particles.map((p) => {
          const style = {
            left: `${p.xPercent}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}ms`,
            ['--heart-drift' as string]: `${p.drift}deg`,
          } as React.CSSProperties;

          if (batch.icon === 'hand') {
            // 👋 rendered as a text glyph in a span — the
            // emoji's native font rendering carries the wave
            // affordance better than any SVG path approximation.
            // Font-size matches the particle's pixel size so the
            // glyph fills the same box the heart SVG would.
            return (
              <span
                key={p.id}
                className={`${styles.particle} ${styles.handGlyph}`}
                style={{
                  ...style,
                  fontSize: `${p.size}px`,
                  lineHeight: 1,
                }}
                aria-hidden="true"
              >
                👋
              </span>
            );
          }

          // Default — flat solid heart SVG. Single-color fill so
          // the cascade reads as a clean graphic motif instead of
          // relying on the system font's glossy emoji rendering.
          return (
            <svg
              key={p.id}
              viewBox="0 0 24 24"
              className={`${styles.particle} ${styles.heart}`}
              style={style}
              aria-hidden="true"
            >
              <path
                d="M12 21s-7-4.35-9.5-9.5C1 8 3.5 4.5 7 4.5c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 3.5 0 6 3.5 4.5 7-2.5 5.15-9.5 9.5-9.5 9.5z"
                fill="#ef4444"
              />
            </svg>
          );
        }),
      )}
    </div>
  );
}
