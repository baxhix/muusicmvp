'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import fields from './AuthFields.module.css';
import styles from './AuthStateButton.module.css';

/**
 * AuthStateButton — CTA de avanço do fluxo de auth com o "Multi state
 * badge" do Motion (idle → pending → success), mantendo o design atual
 * do botão (`fields.btn`: pill gradiente magenta→indigo full-width).
 *
 * Controlado: o `state` vem da página (do flag de submitting). Cada
 * estado é um `motion.span` trocado via AnimatePresence (fade + slide
 * vertical) — pending mostra spinner, success um check desenhado.
 *
 * Cores: `disabled` (= não validado) cai no `.btn:disabled` (preto e
 * branco). Durante `pending` o input já está validado, então o botão
 * fica colorido + spinner e os cliques são bloqueados.
 */

export type AuthButtonState = 'idle' | 'pending' | 'success';

interface AuthStateButtonProps {
  state: AuthButtonState;
  idleLabel: string;
  pendingLabel?: string;
  successLabel?: string;
  /** "Não validado" → desabilita (preto e branco). */
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
}

export default function AuthStateButton({
  state,
  idleLabel,
  pendingLabel = 'Enviando…',
  successLabel = 'Pronto',
  disabled = false,
  type = 'submit',
  onClick,
}: AuthStateButtonProps) {
  const reduce = useReducedMotion();
  const label =
    state === 'pending' ? pendingLabel : state === 'success' ? successLabel : idleLabel;

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-busy={state === 'pending'}
      className={`${fields.btn} ${styles.authBtn}`}
      style={state === 'pending' ? { pointerEvents: 'none' } : undefined}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          className={styles.inner}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 9 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -9 }}
          transition={{ duration: 0.18 }}
        >
          {state === 'pending' && <Spinner reduce={!!reduce} />}
          {state === 'success' && <Check />}
          <span>{label}</span>
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

function Spinner({ reduce }: { reduce: boolean }) {
  return (
    <motion.span
      className={styles.spinner}
      aria-hidden="true"
      animate={reduce ? undefined : { rotate: 360 }}
      transition={reduce ? undefined : { duration: 0.9, repeat: Infinity, ease: 'linear' }}
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
