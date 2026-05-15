'use client';

import { useEffect } from 'react';
import styles from './CommunityPanel.module.css';

/**
 * Right-column overlay for the upcoming Comunidade (forum) surface.
 * The actual discussion threads aren't built yet — for now this is
 * just the shell:
 *
 *   - Same slot as FeedPanel + ConversationsSidebar (top: 10vh;
 *     right: 104px; width: 398px; height: 80vh).
 *   - Same surface treatment (gradient, blur, shadow, radius).
 *   - Same standardized header (title + close button).
 *   - Same rise/fall choreography as ConversationsSidebar.
 *   - "Em breve" placeholder body so the panel feels intentional
 *     rather than empty.
 *
 * Opened via the `app:open-community` CustomEvent the chat-dock
 * shortcut dispatches; controlled here by the parent's
 * `activeOverlay` coordinator (only one of Chat / Community /
 * Superfã / Playlist / Notificações can be visible at a time).
 */
interface CommunityPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function CommunityPanel({ open, onClose }: CommunityPanelProps) {
  // Escape closes the panel — same affordance ConversationsSidebar
  // and the other modal-ish surfaces offer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <aside
      className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
      role="dialog"
      aria-label="Comunidade"
      aria-hidden={!open}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>Comunidade</h2>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Fechar comunidade"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className={styles.body}>
        <div className={styles.placeholder}>
          {/* Decorative icon — chat-bubble cluster, same motif used
              on the dock shortcut so the surface reads as the
              destination of that affordance. */}
          <span className={styles.placeholderIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-3.5L8 17v-3H7a3 3 0 0 1-3-3z" />
              <path d="M13 17a3 3 0 0 0 3 3h.5L19 23v-3h.5A2.5 2.5 0 0 0 22 17.5V14" />
            </svg>
          </span>
          <h3 className={styles.placeholderTitle}>Comunidade chegando em breve</h3>
          <p className={styles.placeholderBody}>
            Em breve esse será o espaço para conversas em grupo, tópicos
            e fóruns de discussão. Por enquanto, fica o lugar reservado.
          </p>
        </div>
      </div>
    </aside>
  );
}
