'use client';

import { useEffect, useState, type AnimationEvent } from 'react';
import { createPortal } from 'react-dom';
import MotionStateButton from './MotionStateButton';
import styles from './DeleteAccountModal.module.css';

interface DeleteAccountModalProps {
  open: boolean;
  onClose: () => void;
  /** Nome a ser digitado pra confirmar a exclusão */
  userName?: string;
}

export default function DeleteAccountModal({
  open,
  onClose,
  userName = 'Ana Beatriz',
}: DeleteAccountModalProps) {
  const [phase, setPhase] = useState<'idle' | 'in' | 'open' | 'out'>(open ? 'in' : 'idle');
  const [confirmName, setConfirmName] = useState('');

  useEffect(() => {
    if (open) {
      setPhase((p) => (p === 'idle' || p === 'out' ? 'in' : p));
    } else {
      setPhase((p) => (p === 'idle' ? 'idle' : 'out'));
    }
  }, [open]);

  // Limpa o input ao fechar
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setConfirmName(''), 360);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleAnimationEnd = (e: AnimationEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (phase === 'in' && e.animationName.includes('delete-rise')) setPhase('open');
    if (phase === 'out' && e.animationName.includes('delete-fall')) setPhase('idle');
  };

  // ESC fecha
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (phase === 'idle') return null;

  const isIn = phase === 'in';
  const isOut = phase === 'out';

  const requiredName = userName.trim();
  const canDelete =
    confirmName.trim().toLowerCase() === requiredName.toLowerCase() &&
    requiredName.length > 0;

  // Portal to <body> so the modal escapes `.shell`'s stacking
  // context (z-index:55 trap) — see EditProfileModal for the full
  // reasoning. Without this, floating siblings outside `.shell`
  // paint over the modal.
  const content = (
    <>
      <div
        className={`${styles.backdrop} ${isOut ? styles.backdropOut : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`${styles.panel} ${isIn ? styles.panelEntering : ''} ${isOut ? styles.panelClosing : ''}`}
        onAnimationEnd={handleAnimationEnd}
        role="dialog"
        aria-modal="true"
        aria-label="Excluir conta"
      >
        <header className={styles.header}>
          <h2 className={styles.title}>Excluir conta</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Fechar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          <p className={styles.intro}>
            Você perderá <strong>Fanpoints, conexões, histórico, Fanverses</strong> e
            seu perfil. Esta ação <strong>não pode ser desfeita</strong>.
          </p>

          <p className={styles.sectionDesc}>
            Para confirmar, digite{' '}
            <strong className={styles.nameTarget}>{requiredName}</strong>
          </p>
          <input
            type="text"
            className={styles.input}
            placeholder="Digite seu nome aqui"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Cancelar
          </button>
          {/* Multi-state badge: idle "Excluir minha conta" →
           *  pending "Excluindo..." → success "Excluído ✓".
           *  await fake 600ms simula latência do backend mock
           *  (até existir endpoint real). */}
          <MotionStateButton
            tone="danger"
            idleLabel="Excluir minha conta"
            pendingLabel="Excluindo…"
            successLabel="Excluído"
            disabled={!canDelete}
            onClick={async () => {
              await new Promise((r) => setTimeout(r, 600));
              setConfirmName('');
              onClose();
            }}
          />
        </footer>
      </aside>
    </>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
