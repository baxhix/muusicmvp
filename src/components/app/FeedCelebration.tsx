'use client';

import { useEffect, useRef, useState } from 'react';
import { fireMotionConfetti } from './MotionConfetti';
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
  /** Marco de Fanpoints atingido pelo usuário. Opcional — só é
   *  usado pra decidir se o burst de confetti dispara
   *  (≥ MIN_CONFETTI_POINTS). Eventos sem `points` (ex.: fim de
   *  quiz) mostram a headline mas NÃO disparam confetti. */
  points?: number;
}

/* Confetti agora é uma celebração rara — só nos múltiplos de 500k
 * de Fanpoints (500k, 1M, 1.5M, …). Per product feedback "Mantenha
 * apenas a cada 500k em 500k". Quiz, fim-de-missão e demais
 * usuários do app:feed-celebrate continuam mostrando a headline +
 * sub do detail, só não disparam confetti. Pra reativar o burst
 * num futuro evento, é só passar `points` múltiplo de 500_000 no
 * detail. Espelha o critério `isCelebratable` de
 * AchievementCelebration. */
const MILESTONE_STEP = 500_000;
function isCelebratable(points: number): boolean {
  return points >= MILESTONE_STEP && points % MILESTONE_STEP === 0;
}

const HOLD_MS = 3600;
const FADE_MS = 400;

/* CONFETTI_COLORS removido — paleta brand agora vive dentro
 *  de MotionConfetti, que é a única origem do confetti pós-
 *  refactor pra motion/react. */

export default function FeedCelebration() {
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

      // Gate de confetti: só dispara se o evento marcar `points`
      // múltiplo de 500_000 (isCelebratable acima). Sem `points`
      // no detail (ex.: fim de quiz), o headline + sub ainda
      // aparecem mas sem burst.
      const shouldFireConfetti =
        typeof detail.points === 'number' && isCelebratable(detail.points);
      if (shouldFireConfetti) {
        fireBurst();
      }

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

  /* Burst de 3 origens espelha o sweep visual que o canvas-
   *  confetti scoped fazia. Agora cada call vai pro MotionConfetti
   *  global (portal pra body), então perdemos o scope ao feed —
   *  é uma celebração viewport-wide. Trade-off aceito: o
   *  MotionConfetti respeita pointer-events: none e os
   *  marcos já são raros (500k em 500k FP). */
  const fireBurst = () => {
    fireMotionConfetti({ origin: { x: 0.2, y: 0.7 } });
    fireMotionConfetti({ origin: { x: 0.5, y: 0.65 } });
    fireMotionConfetti({ origin: { x: 0.8, y: 0.7 } });
  };

  return (
    <div
      className={`${styles.root} ${active ? styles.rootActive : ''} ${exiting ? styles.rootExiting : ''}`}
      aria-hidden={!active}
    >
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
