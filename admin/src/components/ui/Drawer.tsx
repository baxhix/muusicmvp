'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
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
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="drawer-backdrop"
          className={styles.backdrop}
          onClick={onClose}
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        />
      )}
      {open && (
        <motion.aside
          key="drawer-panel"
          role="dialog"
          aria-modal="true"
          className={cn(
            styles.panel,
            size === 'lg' && styles.lg,
            size === 'xl' && styles.xl
          )}
          initial={reduce ? { opacity: 0 } : { x: '100%' }}
          animate={reduce ? { opacity: 1 } : { x: 0 }}
          exit={reduce ? { opacity: 0 } : { x: '100%' }}
          transition={
            reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 300, damping: 34 }
          }
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
        </motion.aside>
      )}
    </AnimatePresence>,
    document.body
  );
}
