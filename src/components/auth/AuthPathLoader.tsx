'use client';

import { motion, useReducedMotion } from 'motion/react';

/**
 * AuthPathLoader — loader no estilo do exemplo "Infinite path drawing"
 * do Motion: em vez de um spinner de borda, um traço que se DESENHA e
 * apaga continuamente ao longo de um caminho fechado (pathLength +
 * pathOffset em loop), com uma rotação lenta por cima.
 *
 * Respeita prefers-reduced-motion (mostra um arco estático).
 */
export default function AuthPathLoader({
  size = 52,
  color = '#ff00b4',
}: {
  size?: number;
  color?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      role="img"
      aria-label="Carregando"
      animate={reduce ? undefined : { rotate: 360 }}
      transition={reduce ? undefined : { duration: 3, ease: 'linear', repeat: Infinity }}
      style={{ overflow: 'visible' }}
    >
      {/* Trilho sutil. */}
      <circle cx="30" cy="30" r="22" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
      {/* Traço que desenha + apaga em loop infinito. */}
      <motion.circle
        cx="30"
        cy="30"
        r="22"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: reduce ? 0.25 : 0, pathOffset: 0 }}
        animate={reduce ? { pathLength: 0.25 } : { pathLength: [0, 0.7, 0], pathOffset: [0, 0.2, 1] }}
        transition={reduce ? undefined : { duration: 1.8, ease: 'easeInOut', repeat: Infinity }}
      />
    </motion.svg>
  );
}
