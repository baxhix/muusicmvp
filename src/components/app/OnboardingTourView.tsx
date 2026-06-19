'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import type { OnboardingTourConfig } from '@/lib/app/onboardingTourSteps';
import styles from './OnboardingTour.module.css';

/**
 * OnboardingTourView — camada PURAMENTE de apresentação do tour.
 *
 * Sem dependência de contexto/hooks do app (nada de useAppShell /
 * useAuth) → pode ser renderizada isolada (rota de preview) pra
 * validar o visual sem subir o /app inteiro. O container
 * `OnboardingTour` cuida de estado, gatilhos e analytics.
 *
 * Fiel ao protótipo HTML: deck de cards (2 cartas-fantasma
 * rotacionadas atrás + carta ativa), dots de progresso, emoji +
 * título + corpo, CTA gradiente, voltar/pular, swipe das cartas
 * (motion) e tela final 🎉.
 */

export interface OnboardingTourViewProps {
  config: OnboardingTourConfig;
  /** 'steps' = deck dos passos; 'done' = tela de celebração. */
  phase: 'steps' | 'done';
  idx: number;
  /** Direção do último movimento (1 = avançar, -1 = voltar). */
  dir: number;
  /** Respeita prefers-reduced-motion (fade simples, sem swipe). */
  reduce: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onFinishDone: () => void;
  onRestart: () => void;
}

function GlobeDecor() {
  /* Bolhas flutuantes (mini-avatares) do passo "globo". Posições em
   * % pra acompanhar o card responsivo. Decorativo. */
  const bubbles = [
    { l: '2%', t: 40, s: 34, g: 'linear-gradient(145deg,#6b46c1,#241436)', dot: true, dur: '6s', d: '0s' },
    { l: '22%', t: 78, s: 26, g: 'linear-gradient(145deg,#b03a6b,#3a1426)', dot: false, dur: '7.4s', d: '1.1s' },
    { l: '43%', t: 8, s: 38, g: 'linear-gradient(145deg,#3a4ea6,#141a3a)', dot: true, dur: '5.6s', d: '.5s' },
    { l: '67%', t: 72, s: 28, g: 'linear-gradient(145deg,#7a46c1,#2a1640)', dot: false, dur: '6.6s', d: '.9s' },
    { l: '85%', t: 34, s: 32, g: 'linear-gradient(145deg,#2a8a6b,#13322a)', dot: true, dur: '7.8s', d: '1.5s' },
  ];
  return (
    <div className={styles.decor} aria-hidden="true">
      {bubbles.map((b, i) => (
        <div
          key={i}
          className={styles.bubble}
          style={{
            left: b.l,
            top: b.t,
            width: b.s,
            height: b.s,
            animationDuration: b.dur,
            animationDelay: b.d,
          }}
        >
          <div className={styles.bubbleInner} style={{ background: b.g }} />
          {b.dot && <span className={styles.bubbleDot} />}
        </div>
      ))}
    </div>
  );
}

export default function OnboardingTourView({
  config,
  phase,
  idx,
  dir,
  reduce,
  onNext,
  onPrev,
  onSkip,
  onFinishDone,
  onRestart,
}: OnboardingTourViewProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const steps = config.steps;
  const step = steps[Math.min(idx, steps.length - 1)];
  const isDone = phase === 'done';

  const cardVariants = reduce
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1, transition: { duration: 0.2 } },
        exit: { opacity: 0, transition: { duration: 0.15 } },
      }
    : {
        enter: (d: number) => ({
          x: d >= 0 ? -440 : 440,
          y: 34,
          rotate: d >= 0 ? -7 : 7,
          opacity: 0,
        }),
        center: {
          x: 0,
          y: 0,
          rotate: 0,
          opacity: 1,
          transition: { duration: 0.46, ease: [0.2, 0.85, 0.25, 1] as const },
        },
        exit: (d: number) => ({
          x: d >= 0 ? 740 : -740,
          y: 90,
          rotate: d >= 0 ? 16 : -16,
          opacity: 0,
          transition: { duration: 0.42, ease: [0.45, 0, 0.7, 0.25] as const },
        }),
      };

  const cardKey = isDone ? 'done' : `step-${idx}`;

  return createPortal(
    <div className={styles.root} role="dialog" aria-modal="true" aria-label="Tour de boas-vindas">
      <div className={styles.scrim} style={{ backdropFilter: `blur(${config.blurAmount}px)`, WebkitBackdropFilter: `blur(${config.blurAmount}px)` }} />

      <div className={styles.deck}>
        {/* Cartas-fantasma empilhadas atrás (só no modo passos). */}
        {!isDone && (
          <>
            <div className={`${styles.ghost} ${styles.ghostA}`} aria-hidden="true" />
            <div className={`${styles.ghost} ${styles.ghostB}`} aria-hidden="true" />
          </>
        )}

        <AnimatePresence custom={dir} initial>
          <motion.div
            key={cardKey}
            className={styles.card}
            custom={dir}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {isDone ? (
              <>
                <div className={styles.content}>
                  <div className={styles.emoji}>{config.done.emoji}</div>
                  <h2 className={styles.title}>{config.done.title}</h2>
                  <p className={styles.body}>{config.done.body}</p>
                </div>
                <div className={styles.footer}>
                  <button type="button" className={styles.cta} style={{ background: config.ctaGradient }} onClick={onFinishDone}>
                    {config.done.cta}
                  </button>
                  <div className={styles.controls}>
                    <button type="button" className={styles.skip} onClick={onRestart}>
                      {config.done.replayLabel}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.dots} aria-hidden="true">
                  {steps.map((s, k) => (
                    <span
                      key={s.id}
                      className={styles.dot}
                      style={{
                        width: k === idx ? 26 : 7,
                        background: k <= idx ? config.accent : 'rgba(255,255,255,.16)',
                      }}
                    />
                  ))}
                </div>

                {step.decor === 'globe' ? <GlobeDecor /> : <div className={styles.decorSpacer} aria-hidden="true" />}

                <div className={styles.content}>
                  {step.emoji ? <div className={styles.emoji}>{step.emoji}</div> : null}
                  <h2 className={styles.title}>{step.title}</h2>
                  <p className={styles.body}>{step.body}</p>
                </div>

                <div className={styles.footer}>
                  <button type="button" className={styles.cta} style={{ background: config.ctaGradient }} onClick={onNext}>
                    {step.cta}
                  </button>
                  <div className={styles.controls}>
                    {idx > 0 && (
                      <button type="button" className={styles.prev} aria-label="Voltar" onClick={onPrev}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 18l-6-6 6-6" />
                        </svg>
                      </button>
                    )}
                    <button type="button" className={styles.skip} onClick={onSkip}>
                      Pular tudo
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
}
