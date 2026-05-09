'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn, uid } from '@/lib/utils';
import {
  IconCheckCircle,
  IconAlert,
  IconInfo,
  IconX,
} from '@/components/icons';
import styles from './Toast.module.css';

export type ToastType = 'default' | 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = uid('toast');
      const toast: Toast = { id, duration: 4000, type: 'default', ...t };
      setToasts((prev) => [...prev, toast]);
      if (toast.duration && toast.duration > 0) {
        setTimeout(() => dismiss(id), toast.duration);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className={styles.viewport} aria-live="polite">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={cn(styles.toast, styles[t.type ?? 'default'])}
                role="status"
              >
                <span className={styles.icon}>
                  {t.type === 'success' && <IconCheckCircle size={12} strokeWidth={2.5} />}
                  {t.type === 'error' && <IconAlert size={12} strokeWidth={2.5} />}
                  {t.type === 'warning' && <IconAlert size={12} strokeWidth={2.5} />}
                  {t.type === 'info' && <IconInfo size={12} strokeWidth={2.5} />}
                  {(!t.type || t.type === 'default') && <IconInfo size={12} strokeWidth={2.5} />}
                </span>
                <div className={styles.body}>
                  <div className={styles.title}>{t.title}</div>
                  {t.description && <div className={styles.description}>{t.description}</div>}
                </div>
                <button
                  type="button"
                  className={styles.close}
                  onClick={() => dismiss(t.id)}
                  aria-label="Fechar notificação"
                >
                  <IconX size={12} />
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
