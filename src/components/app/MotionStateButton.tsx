'use client';

import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import styles from './MotionStateButton.module.css';

/**
 * MotionStateButton — botão com Multi state badge do motion:
 * Idle → Pending → Success/Error → (auto-reset volta a Idle).
 *
 * Cada estado é um `motion.span` swap via AnimatePresence com fade
 * + slide vertical, e `layout` no botão container faz o width
 * animar suavemente entre labels (ex: "Apagar" → "Apagando..." →
 * "Apagado ✓"). Spring snappy 380/32.
 *
 * Uso:
 *   <MotionStateButton
 *     tone="danger"
 *     idleLabel="Apagar"
 *     pendingLabel="Apagando..."
 *     successLabel="Apagado"
 *     onClick={async () => { await api.delete(...) }}
 *   />
 *
 * O componente gerencia o ciclo internamente — chama onClick,
 * mostra pending, depois success/error baseado em throw vs return.
 * resetAfterMs (default 1500) volta pra idle depois do success.
 */
type State = 'idle' | 'pending' | 'success' | 'error';

interface MotionStateButtonProps {
  /** Async handler — return = success, throw = error. */
  onClick: () => Promise<unknown> | unknown;
  idleLabel: string;
  pendingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  /** ms antes do botão voltar pra idle depois de success/error. */
  resetAfterMs?: number;
  /** Se true, fica em success "forever" (não reseta — útil quando
   *  o componente vai desmontar após sucesso). */
  stickySuccess?: boolean;
  /** Estilo: 'primary' (gradient roxo) | 'danger' (vermelho).
   *  default = 'primary'. */
  tone?: 'primary' | 'danger';
  /** Tamanho do botão. */
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  /** Tipo HTML do button — default 'button'. */
  type?: 'button' | 'submit';
  /** Optional icon antes do label idle. */
  icon?: ReactNode;
}

export default function MotionStateButton({
  onClick,
  idleLabel,
  pendingLabel = 'Enviando…',
  successLabel = 'Pronto',
  errorLabel = 'Erro',
  resetAfterMs = 1500,
  stickySuccess = false,
  tone = 'primary',
  size = 'md',
  disabled = false,
  className,
  ariaLabel,
  type = 'button',
  icon,
}: MotionStateButtonProps) {
  const [state, setState] = useState<State>('idle');

  const handleClick = async () => {
    if (state !== 'idle' || disabled) return;
    setState('pending');
    try {
      await onClick();
      setState('success');
      if (!stickySuccess) {
        window.setTimeout(() => setState('idle'), resetAfterMs);
      }
    } catch (err) {
      console.error('[MotionStateButton] handler threw:', err);
      setState('error');
      window.setTimeout(() => setState('idle'), resetAfterMs);
    }
  };

  const label =
    state === 'pending'
      ? pendingLabel
      : state === 'success'
        ? successLabel
        : state === 'error'
          ? errorLabel
          : idleLabel;

  return (
    <motion.button
      type={type}
      layout
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      onClick={handleClick}
      disabled={disabled || state !== 'idle'}
      aria-label={ariaLabel ?? idleLabel}
      aria-busy={state === 'pending'}
      className={`${styles.root} ${styles[tone]} ${styles[size]} ${styles[state]} ${className ?? ''}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          layout="position"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className={styles.labelInner}
        >
          {state === 'pending' && <Spinner />}
          {state === 'success' && <Check />}
          {state === 'error' && <Cross />}
          {state === 'idle' && icon}
          <span>{label}</span>
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

/* ── Inline state icons ──────────────────────────────────── */

function Spinner() {
  return (
    <motion.span
      className={styles.spinner}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M14 8a6 6 0 1 1-3-5.196" />
      </svg>
    </motion.span>
  );
}

function Check() {
  return (
    <motion.svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.iconSvg}
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      aria-hidden="true"
    >
      <motion.path d="M3 8l3.5 3.5L13 5" />
    </motion.svg>
  );
}

function Cross() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className={styles.iconSvg} aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}
