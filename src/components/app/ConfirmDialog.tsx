'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './ConfirmDialog.module.css';

/**
 * Confirm dialog do design system (substitui window.confirm).
 *
 * Disparado por:
 *   const ok = await confirmDialog({
 *     title: 'Apagar conversa?',
 *     body: 'Ela some só pra você.',
 *     confirmLabel: 'Apagar',
 *     cancelLabel: 'Cancelar',
 *     tone: 'danger',
 *   });
 *   if (!ok) return;
 *
 * Implementação: módulo singleton com Promise pendente. O componente
 * renderizado em /app/layout.tsx escuta as chamadas, mostra o modal,
 * e resolve a Promise com o veredito do user. Apenas UMA Promise
 * pendente por vez — chamadas concorrentes substituem a anterior.
 */

export interface ConfirmArgs {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` pinta o botão de confirmar com tom destrutivo neutro
   *  (no design system de chat: cinza-escuro, sem vermelho). */
  tone?: 'default' | 'danger';
}

interface PendingState extends ConfirmArgs {
  resolve: (value: boolean) => void;
}

let pendingRef: PendingState | null = null;
let dispatchRef: ((p: PendingState | null) => void) | null = null;

/** Public API — Promise-based. `false` = cancelado / fechou. */
export function confirmDialog(args: ConfirmArgs): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    // Cancela qualquer Promise pendente — só uma janela por vez.
    if (pendingRef) pendingRef.resolve(false);
    pendingRef = { ...args, resolve };
    dispatchRef?.(pendingRef);
  });
}

export default function ConfirmDialog() {
  const [pending, setPending] = useState<PendingState | null>(null);

  useEffect(() => {
    dispatchRef = setPending;
    return () => {
      dispatchRef = null;
    };
  }, []);

  const settle = useCallback((ok: boolean) => {
    if (pendingRef) {
      pendingRef.resolve(ok);
      pendingRef = null;
    }
    setPending(null);
  }, []);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false);
      else if (e.key === 'Enter') settle(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pending, settle]);

  if (!pending) return null;

  const tone = pending.tone ?? 'default';

  return (
    <div
      className={styles.scrim}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={() => settle(false)}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-title" className={styles.title}>{pending.title}</h3>
        {pending.body && <p className={styles.body}>{pending.body}</p>}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => settle(false)}
            autoFocus
          >
            {pending.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            type="button"
            className={
              tone === 'danger'
                ? `${styles.confirmBtn} ${styles.confirmBtnDanger}`
                : styles.confirmBtn
            }
            onClick={() => settle(true)}
          >
            {pending.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
