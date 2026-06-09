'use client';

import { useEffect, useState } from 'react';
import { fireMotionConfetti } from './MotionConfetti';
import { useAchievements, type MyAchievement } from '@/hooks/useAchievements';
import styles from './AchievementCelebration.module.css';

/* A celebração inteira (mensagem "Você atingiu X Fanpoints" +
 * confetti) agora só aparece a cada 500k em 500k de Fanpoints.
 * Per product feedback "Remova a mensagem 'Você atingiu X
 * Fanpoints. Parabéns!' para os marcos (500, 1k, 50k, etc.).
 * Mantenha apenas a cada 500k em 500k." Marcos menores que o
 * server eventualmente dispare (500, 1k, 5k, 50k, 100k…) chegam
 * pelo socket me:achievement mas são silenciados aqui — a UI
 * não renderiza, então não aparece mensagem nem burst.
 *
 * Filtro: ponto válido = >= 500k E múltiplo de 500k. Cobre 500k,
 * 1M, 1.5M, 2M, etc. Marcos avulsos como 750k não passam. */
const MILESTONE_STEP = 500_000;
function isCelebratable(points: number): boolean {
  return points >= MILESTONE_STEP && points % MILESTONE_STEP === 0;
}

/**
 * Format a point milestone into the human-friendly phrase the user
 * sees on screen. 500 stays as "500"; 1000+ collapses to "X mil".
 */
function formatMilestone(points: number): string {
  if (points < 1000) return `${points} Fanpoints`;
  const k = Math.round(points / 1000);
  return `${k} mil Fanpoints`;
}

/* Fire a multi-burst sweep usando o componente MotionConfetti
 *  (montado globalmente no layout). O componente recebe os
 *  params canônicos pelo módulo — aqui só disparamos com 3
 *  origins distintos pra preservar o sweep visual largo que
 *  o canvas-confetti dava antes. */
function fireConfettiBurst(): void {
  fireMotionConfetti({ origin: { x: 0.2, y: 0.6 } });
  fireMotionConfetti({ origin: { x: 0.5, y: 0.55 } });
  fireMotionConfetti({ origin: { x: 0.8, y: 0.6 } });
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
  // hook's state. Filtramos pra pegar SÓ marcos múltiplos de 500k
  // (isCelebratable acima); o que o server dispara abaixo desse
  // limiar (500, 1k, 50k, etc.) cai aqui silenciosamente.
  const current =
    [...myAchievements].reverse().find((a) => isCelebratable(a.points)) ?? null;
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
    // Chega aqui já filtrado por isCelebratable — todo frame que
    // monta É um marco múltiplo de 500k, então mensagem +
    // confetti rodam juntos sem ramificação adicional.
    fireConfettiBurst();
    // Re-burst at 900ms (metade do antigo 1800) pra acompanhar o
    // lifetime reduzido pela metade do hook.
    const t2 = window.setTimeout(fireConfettiBurst, 900);
    // Fade-out 300ms antes do hook desmontar (lifetime 3500ms).
    const t3 = window.setTimeout(() => setExiting(true), 3200);
    return () => {
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

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
