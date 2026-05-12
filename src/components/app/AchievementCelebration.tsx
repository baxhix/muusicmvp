'use client';

import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { useAchievements, type MyAchievement } from '@/hooks/useAchievements';
import styles from './AchievementCelebration.module.css';

/** Brand palette piped to the confetti library — matches the
 *  Tailwind 600/700 hues we already use elsewhere (Superchat bubbles,
 *  Paraná dots). Avoids generic rainbow vibe. */
const CONFETTI_COLORS = [
  '#4F46E5', // indigo
  '#7C3AED', // violet
  '#0284C7', // sky
  '#0F766E', // teal
  '#15803D', // green
  '#D97706', // amber
  '#DC2626', // red
  '#DB2777', // pink
  '#3DDB74', // accent
];

/**
 * Format a point milestone into the human-friendly phrase the user
 * sees on screen. 500 stays as "500"; 1000+ collapses to "X mil".
 */
function formatMilestone(points: number): string {
  if (points < 1000) return `${points} Fanpoints`;
  const k = Math.round(points / 1000);
  return `${k} mil Fanpoints`;
}

/** Fire a multi-burst confetti sweep using the brand palette. */
function fireConfettiBurst(): void {
  const defaults = {
    spread: 70,
    ticks: 200,
    gravity: 0.9,
    decay: 0.94,
    startVelocity: 32,
    colors: CONFETTI_COLORS,
    disableForReducedMotion: true,
  };
  // Three origins: left, center, right — gives a wider visual sweep
  // than a single burst without doubling the particle budget.
  confetti({ ...defaults, particleCount: 60, origin: { x: 0.2, y: 0.6 } });
  confetti({ ...defaults, particleCount: 90, origin: { x: 0.5, y: 0.55 } });
  confetti({ ...defaults, particleCount: 60, origin: { x: 0.8, y: 0.6 } });
}

/**
 * Full-screen, non-modal celebration overlay. Listens for the
 * me:achievement socket event via useAchievements, fires confetti
 * and centers a congratulatory line. Auto-dismisses with fade-out
 * after ~7s (lifetime managed by the hook). pointer-events: none on
 * the wrapper so the user keeps full interaction with the rest of
 * the app while the overlay plays.
 */
export default function AchievementCelebration() {
  const { myAchievements } = useAchievements();
  // Take the most recent — overlay shows one at a time. Subsequent
  // milestones queue naturally as the current one expires from the
  // hook's state.
  const current = myAchievements[myAchievements.length - 1] ?? null;
  // While a celebration is active, dim the rest of the screen by
  // toggling .rootActive on the wrapper — pure CSS opacity transition
  // on the wrapper's background, no extra DOM. pointer-events stay
  // `none` so the user keeps interacting with the platform.
  return (
    <div
      className={`${styles.root} ${current ? styles.rootActive : ''}`}
      aria-live="polite"
    >
      {current && <CelebrationFrame key={current._localId} item={current} />}
    </div>
  );
}

/** Per-event lifecycle — fires confetti on mount, manages its own
 *  exit animation timer so the fade-out begins ~600ms before the
 *  hook removes the item. */
function CelebrationFrame({ item }: { item: MyAchievement }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    fireConfettiBurst();
    // Re-burst at 1.8s for a longer "trail" without taxing the
    // confetti renderer continuously.
    const t2 = window.setTimeout(fireConfettiBurst, 1800);
    // Trigger fade-out 600ms before the hook unmounts us.
    const t3 = window.setTimeout(() => setExiting(true), 6400);
    return () => {
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  return (
    <div className={`${styles.frame} ${exiting ? styles.frameExit : ''}`}>
      <div className={styles.message}>
        <span className={styles.eyebrow}>Conquista</span>
        <h2 className={styles.headline}>
          Você atingiu <em>{formatMilestone(item.points)}</em>.
        </h2>
        <p className={styles.subtle}>Parabéns!</p>
      </div>
    </div>
  );
}
