'use client';

import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import styles from './MotionCheckbox.module.css';

/**
 * MotionCheckbox — checkbox acessível com check animado, no estilo do
 * exemplo "Checkbox" do Base UI + Motion.
 *
 * Input nativo visualmente escondido (mantém acessibilidade + foco por
 * teclado); a caixa e o tique são desenhados com motion/react — o tique
 * usa "path drawing" (pathLength 0→1) e a caixa dá um spring ao marcar.
 *
 * Cor de acento via CSS var `--mc-accent` (default = magenta do auth).
 */

export interface MotionCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Rótulo à direita da caixa. */
  children: ReactNode;
  ariaLabel?: string;
}

export default function MotionCheckbox({
  checked,
  onChange,
  disabled,
  children,
  ariaLabel,
}: MotionCheckboxProps) {
  const reduce = useReducedMotion();

  return (
    <label
      className={styles.row}
      data-checked={checked || undefined}
      data-disabled={disabled || undefined}
    >
      <input
        type="checkbox"
        className={styles.input}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      <motion.span
        className={styles.box}
        aria-hidden="true"
        initial={false}
        animate={{
          backgroundColor: checked ? 'var(--mc-accent)' : 'rgba(255, 255, 255, 0.04)',
          borderColor: checked ? 'var(--mc-accent)' : 'rgba(255, 255, 255, 0.28)',
          scale: checked && !reduce ? [1, 0.84, 1] : 1,
        }}
        transition={{ duration: 0.3, ease: [0.22, 0.85, 0.25, 1] }}
      >
        <svg viewBox="0 0 24 24" className={styles.check} aria-hidden="true">
          <motion.path
            d="M5 12.5l4.2 4.2L19 7.2"
            fill="none"
            stroke="#fff"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{
              pathLength: { duration: reduce ? 0 : 0.3, ease: 'easeOut', delay: checked ? 0.05 : 0 },
              opacity: { duration: 0.15 },
            }}
          />
        </svg>
      </motion.span>
      <span className={styles.label}>{children}</span>
    </label>
  );
}
