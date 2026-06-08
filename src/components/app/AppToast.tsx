'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import styles from './AppToast.module.css';

/**
 * Toast genérico do /app.
 *
 * Disparado via `window.dispatchEvent(new CustomEvent('app:toast', {
 *   detail: { message, tone? } }))`. Quando o event chega, monta o
 *   toast por ~3s e some fade-out.
 *
 * Existe pra dar feedback de ações com side effect simples (apagar
 * conversa, copiar link, etc.) sem precisar de modal ou alert nativo.
 * Esse pattern é separado do PointsToast (que é específico pra
 * recompensa de pontos) — esse aqui é o utilitário "tudo o resto".
 */

export interface AppToastDetail {
  message: string;
  /** Visual tone. `success` mostra check verde; `error` mostra alerta
   *  vermelho; `info` (default) é cinza neutro. */
  tone?: 'success' | 'error' | 'info';
}

interface ActiveToast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

const TOAST_DURATION_MS = 3200;

let toastSeq = 0;

export default function AppToast() {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AppToastDetail>).detail;
      if (!detail?.message) return;
      // Substitui o toast anterior (UX simples: 1 toast por vez).
      if (timerRef.current) clearTimeout(timerRef.current);
      const id = ++toastSeq;
      setToast({
        id,
        message: detail.message,
        tone: detail.tone ?? 'info',
      });
      timerRef.current = setTimeout(() => {
        setToast((cur) => (cur?.id === id ? null : cur));
      }, TOAST_DURATION_MS);
    };
    window.addEventListener('app:toast', handler as EventListener);
    return () => {
      window.removeEventListener('app:toast', handler as EventListener);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /* AnimatePresence orquestra mount/unmount via slide+fade vertical.
   *  key={toast?.id} força animação a cada novo toast mesmo se o
   *  anterior ainda estiver visível. Substitui CSS animation
   *  manual (toast.toastEnter/Exit). */
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          className={`${styles.toast} ${styles[`tone_${toast.tone}`] ?? ''}`}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        >
          {toast.tone === 'success' && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {toast.tone === 'error' && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 4v4M7 11v.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          )}
          <span>{toast.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Helper conveniente pra disparar o toast de qualquer lugar do app. */
export function showAppToast(detail: AppToastDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app:toast', { detail }));
}
