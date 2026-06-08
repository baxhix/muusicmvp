'use client';

import type { CSSProperties, ReactNode } from 'react';
import styles from './Skeleton.module.css';

/**
 * Skeleton — placeholder com shimmer loading inspirado no pattern
 * "Skeleton Shimmer" do motion. Animação por CSS keyframe puro
 * (background-position sweep) — mais leve que motion.div animate
 * pra um loop infinito sem interatividade.
 *
 * Variantes:
 *   - 'rect'   (default): bloco retangular
 *   - 'circle': square reduzido a círculo (avatar placeholder)
 *   - 'text':   altura menor + border-radius pequena (linha de texto)
 *
 * count > 1 renderiza N skeletons stacked com `animation-delay`
 * cascateado pra simular cascade staggered natural.
 */
interface SkeletonProps {
  /** CSS width — número (px) ou string ('100%', '12em'). */
  width?: number | string;
  /** CSS height — ignorado em variant='circle' (usa width). */
  height?: number | string;
  /** border-radius — ignorado em variant='circle' (50%). */
  borderRadius?: number | string;
  variant?: 'rect' | 'circle' | 'text';
  /** Quantos skeletons stackeados. >1 ativa stagger via delay. */
  count?: number;
  /** Gap (em px) entre múltiplos skeletons quando count > 1. */
  gap?: number;
  /** Classe extra pro wrapper (útil pra escolher block vs inline). */
  className?: string;
  /** Style extra (override caso seja preciso). */
  style?: CSSProperties;
  /** ARIA label pra screen readers — default "Carregando". */
  ariaLabel?: string;
}

export default function Skeleton({
  width = '100%',
  height = 16,
  borderRadius,
  variant = 'rect',
  count = 1,
  gap = 8,
  className,
  style,
  ariaLabel = 'Carregando',
}: SkeletonProps) {
  if (count > 1) {
    return (
      <span
        className={styles.stack}
        style={{ gap }}
        role="status"
        aria-label={ariaLabel}
      >
        {Array.from({ length: count }).map((_, i) => (
          <SingleSkeleton
            key={i}
            width={width}
            height={height}
            borderRadius={borderRadius}
            variant={variant}
            className={className}
            style={{ ...style, animationDelay: `${i * 120}ms` }}
            ariaLabel={undefined /* só o stack carrega o label */}
          />
        ))}
      </span>
    );
  }
  return (
    <SingleSkeleton
      width={width}
      height={height}
      borderRadius={borderRadius}
      variant={variant}
      className={className}
      style={style}
      ariaLabel={ariaLabel}
    />
  );
}

function SingleSkeleton({
  width,
  height,
  borderRadius,
  variant,
  className,
  style,
  ariaLabel,
}: Omit<SkeletonProps, 'count' | 'gap'>): ReactNode {
  const computedRadius =
    variant === 'circle' ? '50%' : (borderRadius ?? (variant === 'text' ? 4 : 6));
  const computedHeight = variant === 'circle' ? width : height;
  const computedH = variant === 'text' ? 12 : computedHeight;
  return (
    <span
      className={`${styles.root} ${className ?? ''}`}
      role={ariaLabel ? 'status' : undefined}
      aria-label={ariaLabel}
      style={{
        width,
        height: computedH,
        borderRadius: computedRadius,
        ...style,
      }}
    />
  );
}
