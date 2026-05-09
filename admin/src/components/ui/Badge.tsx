import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'solid';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: boolean;
}

export default function Badge({
  tone = 'neutral',
  size = 'md',
  dot,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span className={cn(styles.badge, styles[tone], styles[size], className)} {...rest}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  );
}
