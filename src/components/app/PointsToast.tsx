'use client';

import { useEffect, useState } from 'react';
import type { RewardRule } from '@/lib/rewards';
import styles from './PointsToast.module.css';

/**
 * Ephemeral "+N Fanpoints" toast triggered by the rewards loop.
 *
 * Listens for the `app:points-awarded` CustomEvent that
 * `awardPoints()` (src/lib/rewards.ts) dispatches whenever an
 * engagement action lands. Each toast lives for ~2.6s, then fades
 * out and unmounts. Multiple toasts queue and stack vertically
 * above the navbar so a burst of activity (multiple comments in a
 * row, e.g.) doesn't drop any reward acknowledgements.
 *
 * Mounts once at the page level (see /app/page.tsx) — listening
 * via `window.addEventListener` keeps the dispatcher decoupled
 * from this component's import graph.
 */

interface ToastItem {
  id: number;
  rule: RewardRule;
  amount: number;
  label: string;
}

interface PointsAwardedDetail {
  rule: RewardRule;
  amount: number;
  label: string;
}

/** ms before the toast starts its exit animation. */
const HOLD_MS = 2200;
/** ms for the exit fade. Must match `.toastExit` animation in CSS. */
const EXIT_MS = 360;

/** Star glyph used inside the pill — same icon family the
 *  Fanpoints surface in ArtistBox uses, so the toast reads as
 *  "wallet just ticked up". */
const StarIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
    <polygon points="12 2 15.1 8.6 22 9.5 17 14.4 18.3 21.4 12 18 5.7 21.4 7 14.4 2 9.5 8.9 8.6 12 2" />
  </svg>
);

export default function PointsToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let nextId = 0;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PointsAwardedDetail>).detail;
      if (!detail) return;
      const id = nextId++;
      setToasts((prev) => [...prev, { id, ...detail }]);
      // Drop the toast from the array after the hold + exit
      // window, so the DOM stays clean and the stack doesn't grow
      // unbounded across a long session.
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, HOLD_MS + EXIT_MS);
    };
    window.addEventListener('app:points-awarded', handler);
    return () => window.removeEventListener('app:points-awarded', handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.root} role="status" aria-live="polite">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastRow({ toast }: { toast: ToastItem }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setExiting(true), HOLD_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      className={`${styles.toast} ${exiting ? styles.toastExit : styles.toastEnter}`}
    >
      <span className={styles.icon} aria-hidden="true">
        <StarIcon />
      </span>
      <span className={styles.amount}>
        +{toast.amount.toLocaleString('pt-BR')} Fanpoints
      </span>
      <span className={styles.label}>{toast.label}</span>
    </div>
  );
}
