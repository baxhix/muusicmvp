'use client';

import { useMemo } from 'react';
import styles from './Sparkles.module.css';

/**
 * Decoração de "estrelinhas" / partículas espalhadas pelo bg.
 *
 * Estratégia: gera N pontos com posições aleatórias mas
 * determinísticas (seed-based) — assim a renderização não
 * "pula" entre SSR e CSR. Cada ponto tem tamanho e opacidade
 * variando dentro de uma faixa, e uma animação de pulsação
 * sutil.
 *
 * Não usa Canvas/WebGL: são poucas partículas (≤30) e CSS
 * lida bem. Mantém o bundle leve no canvas experimental.
 */

export interface SparklesProps {
  count?: number;
  /** Seed pra reproduzir sempre o mesmo layout entre renders. */
  seed?: number;
}

/** Pseudo-random determinístico baseado em seed (mulberry32). */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function Sparkles({ count = 24, seed = 7 }: SparklesProps) {
  const points = useMemo(() => {
    const rng = makeRng(seed);
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      top: rng() * 100,
      left: rng() * 100,
      size: 1 + rng() * 2.4, // 1–3.4px
      opacity: 0.35 + rng() * 0.5, // 0.35–0.85
      delay: rng() * 4, // animation-delay 0–4s
      duration: 3 + rng() * 4, // 3–7s
    }));
  }, [count, seed]);

  return (
    <div className={styles.layer} aria-hidden="true">
      {points.map((p) => (
        <span
          key={p.id}
          className={styles.dot}
          style={{
            top: `${p.top}%`,
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
