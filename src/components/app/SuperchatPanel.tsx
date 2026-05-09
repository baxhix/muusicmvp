'use client';

import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { useSuperchat } from '@/hooks/useSuperchat';
import { useAuth } from '@/lib/auth/AuthContext';
import styles from './SuperchatPanel.module.css';

interface SuperchatPanelProps {
  open: boolean;
  onClose: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function SuperchatPanel({ open, onClose }: SuperchatPanelProps) {
  const { user } = useAuth();
  const { messages, send, loading } = useSuperchat();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const onSubmit = () => {
    const text = draft.trim();
    if (!text) return;
    send(text);
    setDraft('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  if (!user) return null;

  return (
    <div
      className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
      role="dialog"
      aria-label="Superchat — sala global"
    >
      <div className={styles.header}>
        <div className={styles.title}>
          <span>Superchat</span>
          <span className={styles.titleHint}>sala global</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar superchat">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className={styles.messages}>
        {loading ? (
          <div className={styles.placeholder}>Carregando…</div>
        ) : messages.length === 0 ? (
          <div className={styles.placeholder}>Seja o primeiro a mandar uma mensagem 👋</div>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === user.id;
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
          placeholder="Manda essa pra galera…"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          maxLength={4000}
        />
        <button
          className={styles.sendBtn}
          onClick={onSubmit}
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
