'use client';

import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import type { ApiConversationSummary, ApiMessage } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import styles from './LiveChatPanel.module.css';

// Stubbed for now — backend endpoints for report/block don't exist
// yet. The handlers below confirm with the user and log to console;
// wire to /api/report + /api/block once those land.
async function reportUser(userId: string, name: string | null): Promise<void> {
  if (!window.confirm(`Denunciar ${name ?? 'este usuário'}? A equipe da muusic vai revisar a conta.`)) return;
  console.warn('[chat] TODO: POST /api/report', { targetUserId: userId });
  window.alert('Denúncia enviada. Obrigado por reportar.');
}

async function blockUser(userId: string, name: string | null): Promise<void> {
  if (!window.confirm(`Bloquear ${name ?? 'este usuário'}? Vocês não vão mais conseguir trocar mensagens.`)) return;
  console.warn('[chat] TODO: POST /api/block', { targetUserId: userId });
  window.alert(`${name ?? 'Usuário'} bloqueado.`);
}

interface Props {
  conversation: ApiConversationSummary | null;
  messages: ApiMessage[];
  loading: boolean;
  onClose: () => void;
  onSend: (body: string) => Promise<void>;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * 1-on-1 DM chat panel. Drives `useChatLive` (state owned by parent).
 * Slides in from the right when a conversation is open.
 */
export default function LiveChatPanel({
  conversation,
  messages,
  loading,
  onClose,
  onSend,
}: Props) {
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOpen = conversation !== null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Close the kebab dropdown on outside click + on Escape so it
  // behaves like any other floating menu in the app.
  useEffect(() => {
    if (!menuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // When the conversation changes (or panel closes), drop any open
  // kebab menu — otherwise it'd survive the next open() with stale
  // target context.
  useEffect(() => {
    setMenuOpen(false);
  }, [conversation?.id]);

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    await onSend(text);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const other = conversation?.otherUser;
  const avatar = other?.avatarUrl ?? (other ? `https://i.pravatar.cc/72?u=${other.id}` : null);

  return (
    <div
      className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
      role="dialog"
      aria-label={`Chat com ${other?.name ?? ''}`}
    >
      <div className={styles.header}>
        {avatar && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar} alt={other?.name ?? ''} className={styles.headerAvatar} />
          </>
        )}
        <div className={styles.headerInfo}>
          <span className={styles.headerName}>{other?.name ?? 'Conversa'}</span>
        </div>

        {/* Kebab menu — denounce/block. Stubbed handlers (see top of
            file) since the backend endpoints don't exist yet. The menu
            itself follows the standard floating-menu pattern: click
            outside or press Esc to close, also auto-closes when the
            user switches conversations. */}
        {other && (
          <div className={styles.kebabWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.kebabBtn}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Mais opções"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <svg viewBox="0 0 4 16" width="4" height="16" fill="currentColor" aria-hidden="true">
                <circle cx="2" cy="2"  r="1.6" />
                <circle cx="2" cy="8"  r="1.6" />
                <circle cx="2" cy="14" r="1.6" />
              </svg>
            </button>
            {menuOpen && (
              <div className={styles.kebabMenu} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className={styles.kebabItem}
                  onClick={() => {
                    setMenuOpen(false);
                    reportUser(other.id, other.name ?? null);
                  }}
                >
                  Denunciar usuário
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={`${styles.kebabItem} ${styles.kebabItemDanger}`}
                  onClick={() => {
                    setMenuOpen(false);
                    blockUser(other.id, other.name ?? null);
                  }}
                >
                  Bloquear usuário
                </button>
              </div>
            )}
          </div>
        )}

        <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar conversa">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className={styles.messages}>
        {loading ? (
          <div className={styles.placeholder}>Carregando…</div>
        ) : messages.length === 0 ? (
          <div className={styles.placeholder}>Manda a primeira mensagem 👋</div>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === user?.id;
            return (
              <div
                key={m.id}
                className={`${styles.msg} ${isMine ? styles.msgOut : styles.msgIn}`}
              >
                <div className={styles.bubble}>{m.body}</div>
                <div className={styles.time}>{formatTime(m.createdAt)}</div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className={styles.inputArea}>
        <input
          className={styles.field}
          placeholder="Mensagem…"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          maxLength={4000}
        />
        <button
          className={styles.sendBtn}
          onClick={submit}
          aria-label="Enviar"
          disabled={!draft.trim()}
        >
          <svg viewBox="0 0 14 14" fill="none">
            <path d="M1.5 7.5L12.5 2.5 8.5 12.5 7 8 1.5 7.5z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}
