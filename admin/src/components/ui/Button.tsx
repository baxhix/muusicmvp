'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { IconLoader, IconCheck } from '@/components/icons';
import styles from './Button.module.css';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'danger'
  | 'dangerGhost';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  loading?: boolean;
  /**
   * Multi-state: quando true, mostra um check (spring pop) no lugar
   * do label — confirma visualmente que a ação concluiu. Use junto
   * com loading (loading → success → idle) pra um botão que conta a
   * história da ação. O press feedback (scale) é global a todos.
   */
  success?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    iconOnly = false,
    loading = false,
    success = false,
    leadingIcon,
    trailingIcon,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref
) {
  const reduce = useReducedMotion();
  // Esconde o label sempre que houver um estado (spinner/check) no ar.
  const hasState = loading || success;

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        styles.button,
        styles[variant],
        styles[size],
        iconOnly && styles.iconOnly,
        hasState && styles.loading,
        className
      )}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
      <AnimatePresence initial={false}>
        {loading && (
          <motion.span
            key="loading"
            className={styles.loadingSpinner}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
            transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 520, damping: 30 }}
          >
            <IconLoader size={14} />
          </motion.span>
        )}
        {success && !loading && (
          <motion.span
            key="success"
            className={styles.loadingSpinner}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
            transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 520, damping: 26 }}
          >
            <IconCheck size={15} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
});

export default Button;
