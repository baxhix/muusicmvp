'use client';

import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './MobileSheetShell.module.css';

/**
 * MobileSheetShell — wrapper padronizado pra todas as superfícies
 * que abrem pelo menu hamburger no mobile.
 *
 * Per product feedback "Nas páginas que abrem ao clicar no menu
 * hamburger, faça com que elas tenham um padrão de construção e
 * arquitetura. Me parece que algumas são modais e outras são
 * páginas. Organize essa interação visando a melhor experiencia e
 * performance e um padrão, como a seta de voltar no topo esquerdo,
 * comportamento de arrastar para fechar".
 *
 * Padrão entregue:
 *   - position: fixed; inset: 0 → tela cheia
 *   - Back arrow circular top-left
 *   - Drag handle pill no topo (affordance visual)
 *   - Swipe-down pra fechar (threshold 120px ou velocity-based)
 *   - Backdrop bg dark, animação slide-up sutil
 *   - Portal em document.body pra escapar containing blocks dos pais
 *     (ex.: backdrop-filter do .inner do BottomNav)
 *
 * Uso:
 * ```tsx
 * <MobileSheetShell open={isOpen} onClose={handleClose} title="Meu Perfil">
 *   <YourContentHere />
 * </MobileSheetShell>
 * ```
 */
export default function MobileSheetShell({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  /* SSR safety pro portal — document.body só existe no client. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* Drag-to-close state. dragY = quanto o sheet foi arrastado pra
   * baixo durante o gesto. dragging = se o pointer ainda está down. */
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  /* Threshold de fechamento — se o user soltar com dragY > 120 (px)
   * OU o gesto teve velocity > 0.6 (px/ms recente), fecha. Pequeno
   * timestamp de início ajuda a calcular velocity simples. */
  const dragStartTime = useRef<number>(0);
  const lastY = useRef<number>(0);
  const lastT = useRef<number>(0);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    /* Só captura drag se começou no header — evita conflito com
     * scroll do body. Checamos o currentTarget vs target — se o
     * target estiver dentro de .body, ignoramos. */
    const target = e.target as HTMLElement;
    if (target.closest(`.${styles.body}`)) return;

    dragStartY.current = e.clientY;
    dragStartTime.current = Date.now();
    lastY.current = e.clientY;
    lastT.current = Date.now();
    pointerIdRef.current = e.pointerId;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartY.current == null) return;
    if (pointerIdRef.current !== e.pointerId) return;
    const delta = e.clientY - dragStartY.current;
    /* Só pra baixo — drag pra cima não faz nada (rubber-band poderia
     * existir mas mantém minimal). */
    setDragY(Math.max(0, delta));
    lastY.current = e.clientY;
    lastT.current = Date.now();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartY.current == null) return;
    if (pointerIdRef.current !== e.pointerId) return;
    const totalDelta = e.clientY - dragStartY.current;
    const elapsed = Date.now() - dragStartTime.current;
    const velocity = elapsed > 0 ? totalDelta / elapsed : 0;
    dragStartY.current = null;
    pointerIdRef.current = null;
    setDragging(false);

    /* Threshold: 120px de drag OU velocity > 0.6px/ms (flick rápido). */
    if (totalDelta > 120 || velocity > 0.6) {
      /* Animação de saída — bumpa o sheet pra fora antes de
       * desmontar via onClose. */
      setDragY(window.innerHeight);
      window.setTimeout(onClose, 220);
    } else {
      setDragY(0);
    }
  };

  /* Reset dragY quando o sheet abre/fecha externamente. */
  useEffect(() => {
    if (open) setDragY(0);
  }, [open]);

  /* Escape key fecha o sheet. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const dynamicStyle =
    dragY > 0
      ? {
          transform: `translateY(${dragY}px)`,
          opacity: dragY > 0 ? Math.max(0.4, 1 - dragY / 400) : 1,
        }
      : undefined;

  return createPortal(
    <div
      className={`${styles.shell} ${dragging ? styles.shellDragging : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={dynamicStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className={styles.header}>
        <span className={styles.dragHandle} aria-hidden="true" />
        <button
          type="button"
          className={styles.backBtn}
          onClick={onClose}
          aria-label="Voltar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        {title && <h2 className={styles.title}>{title}</h2>}
      </div>
      <div className={styles.body}>{children}</div>
    </div>,
    document.body,
  );
}
