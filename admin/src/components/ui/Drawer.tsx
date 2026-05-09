'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { IconX } from '@/components/icons';
import styles from './Drawer.module.css';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  footer?: ReactNode;
  children: ReactNode;
  /** Hide the default close button in the header */
  hideCloseButton?: boolean;
}

export default function Drawer({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
  hideCloseButton,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || typeof window === 'undefined') return null;

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          styles.panel,
          size === 'lg' && styles.lg,
          size === 'xl' && styles.xl
        )}
      >
        {(title || !hideCloseButton) && (
          <div className={styles.header}>
            <div>
              {title && <div className={styles.title}>{title}</div>}
              {description && <div className={styles.description}>{description}</div>}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Fechar"
              >
                <IconX size={16} />
              </button>
            )}
          </div>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </aside>
    </>,
    document.body
  );
}
