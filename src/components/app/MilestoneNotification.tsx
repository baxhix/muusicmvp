'use client';

import { useEffect, useState } from 'react';
import styles from './MilestoneNotification.module.css';

/**
 * Top-center celebratory banner for Fanpoints milestones.
 *
 * Listens for the `app:milestone-fp` CustomEvent that
 * `useFanpointMilestones` dispatches every time the viewer's
 * balance crosses a 100-multiple. Each banner shows two lines:
 *
 *   1. "+100 Fanpoints conquistados! Seu total agora é X Fanpoints"
 *      — always shown.
 *   2. "TOP 10! Parabéns, você é um superfã!"
 *      — appended when the milestone payload signals the user
 *        sits inside the top 10 of the global ranking right now.
 *
 * Holds ~5.5s, then fades out. Multiple banners queue and stack
 * vertically, though in practice users rarely cross two 100-FP
 * boundaries inside the same hold window.
 *
 * Mounted once at the page level (see /app/page.tsx).
 */

interface MilestoneItem {
  id: number;
  total: number;
  top10: boolean;
}

interface MilestoneDetail {
  total: number;
  top10: boolean;
}

/** Hold time before the banner starts fading out. */
const HOLD_MS = 5500;
/** Fade duration — must match the `.bannerExit` animation in CSS. */
const EXIT_MS = 380;

export default function MilestoneNotification() {
  const [items, setItems] = useState<MilestoneItem[]>([]);

  useEffect(() => {
    let nextId = 0;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<MilestoneDetail>).detail;
      if (!detail) return;
      const id = nextId++;
      setItems((prev) => [...prev, { id, ...detail }]);
      // Drop the banner from the array after the hold + fade so
      // the DOM stays clean across a long session.
      window.setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }, HOLD_MS + EXIT_MS);
    };
    window.addEventListener('app:milestone-fp', handler);
    return () => window.removeEventListener('app:milestone-fp', handler);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className={styles.root} role="status" aria-live="polite">
      {items.map((item) => (
        <MilestoneBanner key={item.id} item={item} />
      ))}
    </div>
  );
}

function MilestoneBanner({ item }: { item: MilestoneItem }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setExiting(true), HOLD_MS);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      className={`${styles.banner} ${exiting ? styles.bannerExit : styles.bannerEnter}`}
    >
      <p className={styles.line1}>
        +100 Fanpoints conquistados! Seu total agora é{' '}
        <strong className={styles.amount}>
          {item.total.toLocaleString('pt-BR')} Fanpoints
        </strong>
      </p>
      {item.top10 && (
        <p className={styles.line2}>
          <strong>TOP 10!</strong> Parabéns, você é um superfã!
        </p>
      )}
    </div>
  );
}
