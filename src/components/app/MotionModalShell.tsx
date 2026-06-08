'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import styles from './MotionModalShell.module.css';

/**
 * MotionModalShell — wrapper padrão pra modais centrais.
 *
 * Substitui os ~8 keyframes CSS ad-hoc (panelIn, scrim-fade, etc)
 * espalhados pelo app por um único componente:
 *  - Backdrop fade in/out via opacity (motion.div)
 *  - Modal scale + translateY spring (motion.div)
 *  - AnimatePresence orquestra exit antes do unmount
 *  - Portal pra document.body (escapa containing blocks)
 *  - Outside click + Escape fecham (configurável)
 *
 * Uso:
 *   <MotionModalShell open={open} onClose={onClose}>
 *     <h3>Título</h3>
 *     <p>Body</p>
 *   </MotionModalShell>
 */
interface MotionModalShellProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Allow click no backdrop fechar (default true). */
  dismissOnBackdropClick?: boolean;
  /** Allow Escape fechar (default true). */
  dismissOnEscape?: boolean;
  /** Classe extra no .modal interno (cor de fundo custom, max-w). */
  modalClassName?: string;
  /** Classe extra no .scrim (blur intensity custom). */
  scrimClassName?: string;
  ariaLabel?: string;
}

export default function MotionModalShell({
  open,
  onClose,
  children,
  dismissOnBackdropClick = true,
  dismissOnEscape = true,
  modalClassName,
  scrimClassName,
  ariaLabel,
}: MotionModalShellProps) {
  /* Portal gating — só monta no client (document.body não existe em SSR). */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* Escape handler — só ativo quando open=true pra não overhead. */
  useEffect(() => {
    if (!open || !dismissOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissOnEscape, onClose]);

  if (!mounted || typeof document === 'undefined') return null;

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`${styles.scrim} ${scrimClassName ?? ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          onClick={() => dismissOnBackdropClick && onClose()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className={`${styles.modal} ${modalClassName ?? ''}`}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
