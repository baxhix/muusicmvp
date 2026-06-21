'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import styles from './Button.module.css';

/**
 * Button — primitivo canônico do DS Plataforma (camada src/components/ui/).
 *
 * Consolida SectionCTA (link na landing), AuthStateButton (controlado, fluxo
 * de auth) e MotionStateButton (auto-gerenciado, dialogs). Três modos:
 *
 *  1. Link    — passe `href`. Vira <Link> com o visual da variante (sem estado).
 *  2. Controlado — passe `state` ('idle'|'pending'|'success'|'error'). O pai
 *     controla (ex.: fluxo de auth com flag de submitting).
 *  3. Auto-gerenciado — não passe `state`; se `onClick` devolve uma Promise, o
 *     botão cicla idle→pending→success/error→idle sozinho (ex.: dialogs).
 *
 * Variantes: primary (pill gradiente), danger, ghost. Sizes: sm/md/lg.
 * Respeita prefers-reduced-motion. CSS em Button.module.css.
 */

export type ButtonVariant = 'primary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonState = 'idle' | 'pending' | 'success' | 'error';

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
  /** Ícone antes do label no estado idle. */
  icon?: ReactNode;
}

interface LinkProps extends BaseProps {
  href: string;
  onClick?: never;
  state?: never;
}

interface ButtonProps extends BaseProps {
  href?: never;
  /** Controlado: o pai passa o estado. Se omitido + onClick async → auto. */
  state?: ButtonState;
  /** return = success, throw = error (modo auto-gerenciado). */
  onClick?: () => void | Promise<unknown> | unknown;
  type?: 'button' | 'submit';
  disabled?: boolean;
  ariaLabel?: string;
  pendingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  /** ms até voltar pra idle após success/error (auto). Default 1500. */
  resetAfterMs?: number;
  /** Mantém success sem resetar (útil quando o componente desmonta). */
  stickySuccess?: boolean;
}

type Props = LinkProps | ButtonProps;

function cx(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export default function Button(props: Props) {
  const {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    children,
    className,
    icon,
  } = props;

  const classes = cx(
    styles.root,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    className,
  );

  // ── Modo 1: link ──────────────────────────────────────
  if ('href' in props && props.href != null) {
    return (
      <Link href={props.href} className={classes}>
        {icon}
        {children}
      </Link>
    );
  }

  return <StatefulButton {...(props as ButtonProps)} classes={classes} icon={icon}>{children}</StatefulButton>;
}

function StatefulButton({
  state: controlledState,
  onClick,
  type = 'button',
  disabled = false,
  ariaLabel,
  pendingLabel = 'Enviando…',
  successLabel = 'Pronto',
  errorLabel = 'Erro',
  resetAfterMs = 1500,
  stickySuccess = false,
  classes,
  icon,
  children,
}: ButtonProps & { classes: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  const [autoState, setAutoState] = useState<ButtonState>('idle');
  const isControlled = controlledState != null;
  const state = isControlled ? controlledState! : autoState;

  const handleClick = async () => {
    if (isControlled || !onClick) {
      onClick?.();
      return;
    }
    if (autoState !== 'idle' || disabled) return;
    const result = onClick();
    if (!(result instanceof Promise)) return; // síncrono → sem ciclo de estado
    setAutoState('pending');
    try {
      await result;
      setAutoState('success');
      if (!stickySuccess) window.setTimeout(() => setAutoState('idle'), resetAfterMs);
    } catch (err) {
      console.error('[Button] handler threw:', err);
      setAutoState('error');
      window.setTimeout(() => setAutoState('idle'), resetAfterMs);
    }
  };

  const label =
    state === 'pending'
      ? pendingLabel
      : state === 'success'
        ? successLabel
        : state === 'error'
          ? errorLabel
          : children;

  return (
    <motion.button
      type={type}
      onClick={handleClick}
      disabled={disabled || (!isControlled && autoState !== 'idle')}
      aria-busy={state === 'pending'}
      aria-label={ariaLabel}
      className={classes}
      style={state === 'pending' ? { pointerEvents: 'none' } : undefined}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          className={styles.labelInner}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 9 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -9 }}
          transition={{ duration: 0.18 }}
        >
          {state === 'pending' && <Spinner reduce={!!reduce} />}
          {state === 'success' && <Check />}
          {state === 'error' && <Cross />}
          {state === 'idle' && icon}
          <span>{label}</span>
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

function Spinner({ reduce }: { reduce: boolean }) {
  return (
    <motion.span
      className={styles.spinner}
      aria-hidden="true"
      animate={reduce ? undefined : { rotate: 360 }}
      transition={reduce ? undefined : { duration: 0.9, repeat: Infinity, ease: 'linear' }}
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M14 8a6 6 0 1 1-3-5.196" />
      </svg>
    </motion.span>
  );
}

function Check() {
  return (
    <motion.svg
      viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" className={styles.iconSvg}
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
      transition={{ duration: 0.32, ease: 'easeOut' }} aria-hidden="true"
    >
      <motion.path d="M3 8l3.5 3.5L13 5" />
    </motion.svg>
  );
}

function Cross() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" className={styles.iconSvg} aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}
