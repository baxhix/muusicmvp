'use client';

import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import styles from './FeedCelebration.module.css';

/* ── Feed-scoped celebration overlay ──
 *
 * Lives INSIDE the FeedPanel (absolutely positioned over its
 * content area). Listens for `app:feed-celebrate` and fires a
 * confetti burst scoped to its local canvas — never spills into
 * the rest of the viewport. Visually mirrors AchievementCelebration
 * but contained to the feed envelope so the rest of the platform
 * (player, dock, map) stays uninterrupted.
 *
 * Event payload:
 *   detail: { headline?: string; sub?: string }
 *
 * Auto-dismisses after ~3.6s (visible until then, then a soft fade
 * over 400ms). Stacking events queue naturally — a new one just
 * replaces the current message and re-fires the burst.
 */

interface CelebrateDetail {
  headline?: string;
  sub?: string;
}

const HOLD_MS = 3600;
const FADE_MS = 400;

// Brand palette mirrored from AchievementCelebration so the
// two surfaces feel like the same family.
const CONFETTI_COLORS = [
  '#4F46E5',
  '#7C3AED',
  '#0284C7',
  '#0F766E',
  '#15803D',
  '#D97706',
  '#DC2626',
  '#DB2777',
  '#3DDB74',
];

export default function FeedCelebration() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Cached scoped confetti instance. Recreated whenever the canvas
  // mounts; null until the ref is wired.
  const fireRef = useRef<ReturnType<typeof confetti.create> | null>(null);

  const [active, setActive] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [message, setMessage] = useState<CelebrateDetail>({});

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CelebrateDetail>).detail ?? {};
      setMessage(detail);
      setActive(true);
      setExiting(false);

      // (Re)create the scoped confetti factory if needed. `resize:
      // true` makes the canvas-confetti library auto-rescale to the
      // canvas element's bounding box, which changes as the panel
      // animates / the user resizes the viewport.
      if (canvasRef.current && !fireRef.current) {
        fireRef.current = confetti.create(canvasRef.current, {
          resize: true,
          useWorker: false,
        });
      }
      fireBurst();

      // Schedule fade-out + unmount-ish state cleanup.
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      dismissTimerRef.current = setTimeout(() => setExiting(true), HOLD_MS);
      fadeTimerRef.current = setTimeout(() => {
        setActive(false);
        setExiting(false);
      }, HOLD_MS + FADE_MS);
    };

    window.addEventListener('app:feed-celebrate', handler);
    return () => {
      window.removeEventListener('app:feed-celebrate', handler);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  const fireBurst = () => {
    const fire = fireRef.current;
    if (!fire) return;
    const defaults = {
      spread: 70,
      ticks: 200,
      gravity: 0.9,
      decay: 0.94,
      startVelocity: 32,
      colors: CONFETTI_COLORS,
      disableForReducedMotion: true,
    };
    // Three origins for a wider sweep — same recipe as
    // AchievementCelebration, just scoped to the local canvas.
    fire({ ...defaults, particleCount: 50, origin: { x: 0.2, y: 0.7 } });
    fire({ ...defaults, particleCount: 80, origin: { x: 0.5, y: 0.65 } });
    fire({ ...defaults, particleCount: 50, origin: { x: 0.8, y: 0.7 } });
  };

  return (
    <div
      className={`${styles.root} ${active ? styles.rootActive : ''} ${exiting ? styles.rootExiting : ''}`}
      aria-hidden={!active}
    >
      {/* Always-mounted canvas — confetti.create() needs a stable
          ref. Sits below the message so particles read as falling
          behind the headline. */}
      <canvas ref={canvasRef} className={styles.canvas} />

      {active && (
        <div className={styles.message}>
          <h3 className={styles.headline}>
            {message.headline ?? 'Mandou bem!'}
          </h3>
          {message.sub && (
            <p className={styles.sub}>
              <em>{message.sub}</em>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
