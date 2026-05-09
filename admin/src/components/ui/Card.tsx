import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  elevated?: boolean;
  flush?: boolean;
}

export function Card({ interactive, elevated, flush, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        styles.card,
        interactive && styles.interactive,
        elevated && styles.elevated,
        flush && styles.flush,
        className
      )}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  description,
  actions,
  noBorder,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  noBorder?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(styles.header, noBorder && styles.headerNoBorder, className)}>
      <div>
        {title && <div className={styles.title}>{title}</div>}
        {description && <div className={styles.description}>{description}</div>}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}

export function CardBody({
  compact,
  className,
  children,
}: {
  compact?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(styles.body, compact && styles.bodyCompact, className)}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(styles.footer, className)}>{children}</div>;
}
