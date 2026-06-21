'use client';

import { motion, useReducedMotion } from 'motion/react';
import styles from './MotionSwitch.module.css';

/**
 * MotionSwitch — toggle estilo Radix Switch animado com motion.
 *
 * Substitui as duas implementações ad-hoc de toggle que existiam
 * no app (EditProfileModal Toggle e NotificationPreferencesModal
 * checkbox+CSS): o track recebe a cor verde quando checked, e o
 * thumb desliza usando spring motion ao invés de CSS transition
 * (snappier, sem easing genérico).
 *
 * API mirroring Radix: `checked` + `onCheckedChange(value)`.
 * `role="switch"` + `aria-checked` cumprem ARIA pra screen readers.
 */
interface MotionSwitchProps {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  /** A11y label — obrigatório quando não há <label> envolvente. */
  ariaLabel?: string;
  /** Opcional: dimensões maiores/menores. Default = medium. */
  size?: 'sm' | 'md';
  /** Desabilita interação + reduz opacidade. */
  disabled?: boolean;
}

export default function MotionSwitch({
  checked,
  onCheckedChange,
  ariaLabel,
  size = 'md',
  disabled = false,
}: MotionSwitchProps) {
  /* prefers-reduced-motion: o thumb troca de lado instantâneo (sem
   *  spring) — estado final idêntico, só sem a animação de deslize. */
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`${styles.root} ${styles[size]} ${checked ? styles.checked : ''}`}
      onClick={() => !disabled && onCheckedChange(!checked)}
    >
      <motion.span
        className={styles.thumb}
        layout
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 700, damping: 36 }}
      />
    </button>
  );
}
