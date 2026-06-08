'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import styles from './HeartButton.module.css';

/**
 * HeartButton — botão de curtir com motion:
 *  - Active state: heart filled rosa
 *  - Inactive: heart outline cinza
 *  - Toggle dispara: scale pop spring + path morph (outline→fill via
 *    cross-fade) + 6 sparkles emergindo radial (estilo Instagram)
 *
 * Sparkles renderizam só durante a transição inactive→active
 * (~600ms), via AnimatePresence. Suprimido em prefers-reduced-motion.
 */
interface HeartButtonProps {
  active: boolean;
  /** Async ou sync handler — toggle dispara antes de aguardar. */
  onToggle: () => void | Promise<unknown>;
  /** Counter opcional ao lado do heart. */
  count?: number;
  /** Tamanho do ícone (px) — default 18. */
  size?: number;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

const SPARKLE_COUNT = 6;

export default function HeartButton({
  active,
  onToggle,
  count,
  size = 18,
  disabled = false,
  ariaLabel,
  className,
}: HeartButtonProps) {
  const [burst, setBurst] = useState(0);

  const handleClick = () => {
    if (disabled) return;
    /* Trigger sparkle burst APENAS quando passando inactive→active.
     *  Incrementa key pra forçar AnimatePresence remontar sparkles. */
    if (!active) setBurst((n) => n + 1);
    void onToggle();
  };

  return (
    <button
      type="button"
      className={`${styles.root} ${active ? styles.active : ''} ${className ?? ''}`}
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel ?? (active ? 'Descurtir' : 'Curtir')}
    >
      <motion.span
        className={styles.iconWrap}
        style={{ width: size, height: size }}
        /* Scale pop: 0.85 ao click, spring back to 1. key={active+burst}
         *  força animação a cada toggle. */
        animate={{ scale: active ? [0.85, 1.2, 1] : [0.85, 1] }}
        transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
        key={`${active}-${burst}`}
      >
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <path
            d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            fill={active ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Sparkles radial — 6 dots que voam pra fora a partir do
         *  centro do heart. Só renderiza durante o burst (key muda). */}
        <AnimatePresence>
          {burst > 0 && active && (
            <SparkleBurst key={burst} size={size} />
          )}
        </AnimatePresence>
      </motion.span>
      {count !== undefined && count > 0 && (
        <span className={styles.count}>{count}</span>
      )}
    </button>
  );
}

function SparkleBurst({ size }: { size: number }) {
  /* Distance from center where sparkles end — proporcional ao size. */
  const radius = size * 1.2;
  return (
    <span className={styles.sparkleLayer} aria-hidden="true">
      {Array.from({ length: SPARKLE_COUNT }).map((_, i) => {
        const angle = (i / SPARKLE_COUNT) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <motion.span
            key={i}
            className={styles.sparkle}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
            animate={{ x, y, opacity: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
        );
      })}
    </span>
  );
}
