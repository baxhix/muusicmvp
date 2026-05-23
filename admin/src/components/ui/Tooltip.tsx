'use client';

import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import styles from './Tooltip.module.css';
import { cn } from '@/lib/utils';

export interface TooltipProps {
  /** Conteúdo do tooltip — texto curto, idealmente 1-2 palavras. */
  label: ReactNode;
  /** O elemento que dispara o tooltip no hover/focus. Deve ser um
   *  único ReactElement (não um string ou fragment) pra que possamos
   *  injetar aria-describedby + handlers via cloneElement. */
  children: ReactElement;
  /** Lado em que o tooltip aparece relativo ao trigger. Default
   *  'right' — pareia com sidebars verticais (caso de uso principal
   *  per product feedback). */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Forçar o tooltip a NÃO renderizar (útil quando o sidebar está
   *  expandido e o label já está visível). */
  disabled?: boolean;
  /** Delay em ms antes do tooltip aparecer no hover. Default 120ms —
   *  rápido o suficiente pra parecer responsivo, lento o suficiente
   *  pra não disparar em passagens rápidas de mouse. */
  delay?: number;
}

/**
 * Tooltip custom — pill escuro estilo flutuante. Per product feedback
 * "adicione tooltips personalizados estilo o da imagem em anexo" (um
 * pill dark anchorado ao lado do ícone da sidebar quando collapsed).
 *
 * Implementação:
 *   - Wrapper inline-block que captura mouseenter/leave + focus/blur.
 *   - Filho clonado pra herdar aria-describedby (acessível) + handlers
 *     sem o consumer ter que plumbear.
 *   - Tooltip absolute-positioned relativo ao wrapper. Side
 *     determina a transform e o ::before "tail" tringular.
 *   - Delay-in pra evitar flash em passagens rápidas de mouse.
 *   - Sem portal — o tooltip vive no DOM tree do trigger. Suficiente
 *     pra sidebar; se ficar limitado por overflow:hidden de um
 *     ancestral, migra-se pra portal depois.
 */
export default function Tooltip({
  label,
  children,
  side = 'right',
  disabled = false,
  delay = 120,
}: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pendingTimeout, setPendingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  if (!isValidElement(children)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Tooltip: children deve ser um único ReactElement.');
    }
    return <>{children}</>;
  }

  if (disabled) {
    // Bypass — devolve o filho direto, sem wrapper, pra que estilos
    // de layout do consumer não mudem só por causa do tooltip
    // estar "presente mas inerte".
    return children;
  }

  const show = () => {
    const t = setTimeout(() => setOpen(true), delay);
    setPendingTimeout(t);
  };
  const hide = () => {
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      setPendingTimeout(null);
    }
    setOpen(false);
  };

  // Tipagem mínima do filho clonado — o cloneElement preserva o
  // resto das props; só estendemos os eventos + aria. O type
  // assertion existe pra que TS não reclame do shape genérico de
  // ReactElement<unknown>.
  const childProps = (children.props ?? {}) as Record<string, unknown>;
  const enhancedChild = cloneElement(children as ReactElement<Record<string, unknown>>, {
    'aria-describedby': open ? id : undefined,
    onMouseEnter: (e: React.MouseEvent) => {
      const prev = childProps.onMouseEnter as ((e: React.MouseEvent) => void) | undefined;
      prev?.(e);
      show();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      const prev = childProps.onMouseLeave as ((e: React.MouseEvent) => void) | undefined;
      prev?.(e);
      hide();
    },
    onFocus: (e: React.FocusEvent) => {
      const prev = childProps.onFocus as ((e: React.FocusEvent) => void) | undefined;
      prev?.(e);
      setOpen(true);
    },
    onBlur: (e: React.FocusEvent) => {
      const prev = childProps.onBlur as ((e: React.FocusEvent) => void) | undefined;
      prev?.(e);
      setOpen(false);
    },
  });

  return (
    <span className={styles.wrap}>
      {enhancedChild}
      <span
        id={id}
        role="tooltip"
        className={cn(
          styles.bubble,
          styles[`side_${side}`],
          open && styles.bubbleOpen,
        )}
      >
        {label}
      </span>
    </span>
  );
}
