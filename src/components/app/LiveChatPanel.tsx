'use client';

import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import type { ApiConversationSummary, ApiMessage } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import styles from './LiveChatPanel.module.css';

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
  const endRef = useRef<HTMLDivElement>(null);

  const isOpen = conversation !== null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

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
