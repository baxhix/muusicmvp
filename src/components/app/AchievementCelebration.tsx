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

/* Confetti agora é uma celebração rara — sai só no marco de
 * 500k Fanpoints (e marcos superiores, se vierem a existir).
 * Per product feedback "Deixe as animações de confetis aparecerem
 * apenas quando os usuários atingirem 500k de fanpoints". A
 * mensagem visual ("Você atingiu X Fanpoints. Parabéns!") continua
 * aparecendo pros marcos menores, só o burst de confetti fica
 * gated. */
const MIN_CONFETTI_POINTS = 500_000;

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
  // que um burst só. Counts ajustados pela metade do original
  // (60/90/60 → 30/45/30) pra celebração mais discreta.
  confetti({ ...defaults, particleCount: 30, origin: { x: 0.2, y: 0.6 } });
  confetti({ ...defaults, particleCount: 45, origin: { x: 0.5, y: 0.55 } });
  confetti({ ...defaults, particleCount: 30, origin: { x: 0.8, y: 0.6 } });
}

/**
 * Full-screen, non-modal celebration overlay. Listens for the
 * me:achievement socket event via useAchievements, fires confetti
 * and centers a congratulatory line. Auto-dismisses with fade-out
 * after ~3.5s (lifetime managed by the hook — diminuído pela
 * metade do original 7s pra mensagem ser mais discreta).
 * pointer-events: none on the wrapper so the user keeps full
 * interaction with the rest of the app while the overlay plays.
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
    // Confetti gated em MIN_CONFETTI_POINTS — só atira no marco
    // de 500k Fanpoints (ou superior). A mensagem visual abaixo
    // continua aparecendo pra qualquer marco; só o burst é raro.
    const shouldFireConfetti = item.points >= MIN_CONFETTI_POINTS;
    let t2: number | null = null;
    if (shouldFireConfetti) {
      fireConfettiBurst();
      // Re-burst at 900ms (metade do antigo 1800) pra acompanhar o
      // lifetime reduzido pela metade do hook.
      t2 = window.setTimeout(fireConfettiBurst, 900);
    }
    // Fade-out 300ms antes do hook desmontar (lifetime 3500ms).
    const t3 = window.setTimeout(() => setExiting(true), 3200);
    return () => {
      if (t2 !== null) window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [item.points]);

  return (
    <div className={`${styles.frame} ${exiting ? styles.frameExit : ''}`}>
      <div className={styles.message}>
        <h2 className={styles.headline}>
          Você atingiu <em>{formatMilestone(item.points)}</em>.
        </h2>
        <p className={styles.subtle}>Parabéns!</p>
      </div>
    </div>
  );
}
