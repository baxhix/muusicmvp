'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import styles from './Onboarding.module.css';

type Step = {
  eyebrow: string;
  title: string;
  desc: React.ReactNode;
  icon: React.ReactNode;
  accent: string;
  primaryLabel?: string;
  primaryIcon?: React.ReactNode;
};

const STEPS: Step[] = [
  {
    eyebrow: 'Sua vibe',
    title: 'Mostre que você é superfã.',
    desc: (
      <>
        Cumpra <strong>missões diárias</strong>, suba no leaderboard e desbloqueie
        recompensas exclusivas dos artistas que você ama.
      </>
    ),
    accent: '#F5C062',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3l2.39 4.84 5.34.78-3.86 3.77.91 5.32L12 15.2l-4.78 2.51.91-5.32-3.86-3.77 5.34-.78L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    eyebrow: 'Sua trilha',
    title: 'Conecte sua Amazon Music.',
    desc: (
      <>
        Sincronize o que você ouve para encontrar fãs do mesmo som e
        <strong> compartilhar sua trilha</strong> com a comunidade em tempo real.
      </>
    ),
    accent: '#22D3EE',
    primaryLabel: 'Conectar Amazon Music',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 18V6.5l9-2v11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6.5" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="15.5" cy="15.5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    eyebrow: 'O mundo',
    title: 'Veja o mundo pulsar.',
    desc: (
      <>
        Cada ponto é alguém <strong>ouvindo música agora</strong>. Toque no mapa
        para descobrir o que cada cidade está escutando em tempo real.
      </>
    ),
    accent: '#7DD3FC',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
];

const STORAGE_KEY = 'fanverse:onboardingDone';

export default function Onboarding() {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft' && idx > 0) setIdx(idx - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx]);

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch { /* ignore */ }
    setOpen(false);
  };

  const skip = () => {
    finish();
  };

  const next = () => {
    if (idx >= STEPS.length - 1) {
      finish();
      return;
    }
    setIdx(idx + 1);
  };

  if (!open) return null;

  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  const accentVar = { '--ob-accent': step.accent } as CSSProperties;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Apresentação do Fanverse">
      <div className={styles.card} style={accentVar}>
        <div className={styles.glow} aria-hidden="true" />

        <div className={styles.progress} aria-label={`Passo ${idx + 1} de ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${
                i === idx ? styles.dotActive : i < idx ? styles.dotDone : ''
              }`}
            />
          ))}
        </div>

        <div key={idx} className={styles.body}>
          <div className={styles.iconWrap}>{step.icon}</div>
          <span className={styles.eyebrow}>{step.eyebrow}</span>
          <h2 className={styles.title}>{step.title}</h2>
          <p className={styles.desc}>{step.desc}</p>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.skipBtn} onClick={skip}>
            Pular
          </button>

          <div className={styles.footerActions}>
            {idx > 0 && (
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => setIdx(idx - 1)}
                aria-label="Voltar"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={next}
            >
              {step.primaryLabel ?? (isLast ? 'Começar a explorar' : 'Próximo')}
              {step.primaryLabel
                ? step.primaryIcon
                : !isLast && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
