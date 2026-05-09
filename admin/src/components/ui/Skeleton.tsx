import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  variant?: 'block' | 'text' | 'circle';
  className?: string;
  style?: CSSProperties;
}

export default function Skeleton({
  width,
  height,
  variant = 'block',
  className,
  style,
}: SkeletonProps) {
  return (
    <span
      className={cn(
        styles.skeleton,
        variant === 'text' && styles.text,
        variant === 'circle' && styles.circle,
        className
      )}
      style={{
        width,
        height,
        ...style,
      }}
      aria-busy="true"
      aria-live="polite"
    />
  );
}
