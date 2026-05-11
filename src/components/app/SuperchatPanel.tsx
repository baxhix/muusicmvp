'use client';

import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { useSuperchat } from '@/hooks/useSuperchat';
import { useAuth } from '@/lib/auth/AuthContext';
import type { ApiMessage } from '@/lib/api/types';
import styles from './SuperchatPanel.module.css';

interface SuperchatPanelProps {
  open: boolean;
  onClose: () => void;
}

const JOINED_KEY = 'muusic:superchat:joined';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function senderLabel(m: ApiMessage): string {
  if (m.senderName?.trim()) return m.senderName.trim();
  if (m.senderEmail) return m.senderEmail.split('@')[0];
  return 'Anônimo';
}

function senderAvatarUrl(m: ApiMessage): string {
  return m.senderAvatarUrl ?? `https://i.pravatar.cc/72?u=${m.senderId}`;
}

export default function SuperchatPanel({ open, onClose }: SuperchatPanelProps) {
  const { user } = useAuth();

  // 'joined' is persisted in localStorage so the entrance screen only shows
  // on the very first interaction. The user can still tap Sair to reset
  // (TODO if/when we add that flow).
  const [joined, setJoined] = useState(false);
  useEffect(() => {
    try {
      setJoined(localStorage.getItem(JOINED_KEY) === '1');
    } catch {
      // localStorage may be blocked in private windows — treat as not-joined.
      setJoined(false);
    }
  }, []);

  // Only fetch/join the room once the user is open AND has accepted the
  // entrance screen.
  const { messages, send, loading } = useSuperchat(open && joined);

  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleEnter = () => {
    try {
      localStorage.setItem(JOINED_KEY, '1');
    } catch {
      // ignore — entering still works for this session
    }
    setJoined(true);
  };

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

      {!joined ? (
        <EntranceScreen onEnter={handleEnter} />
      ) : (
        <>
          <div className={styles.messages}>
            {loading ? (
              <div className={styles.placeholder}>Carregando…</div>
            ) : messages.length === 0 ? (
              <div className={styles.placeholder}>Seja o primeiro a mandar uma mensagem 👋</div>
            ) : (
              messages.map((m, i) => {
                const isMine = m.senderId === user.id;
                // Collapse the avatar/name header for consecutive messages from
                // the same sender so a burst of texts feels conversational.
                const prev = i > 0 ? messages[i - 1] : null;
                const showHead = !isMine && (!prev || prev.senderId !== m.senderId);

                return (
                  <div
                    key={m.id}
                    className={`${styles.msg} ${isMine ? styles.msgOut : styles.msgIn}`}
                  >
                    {showHead && (
                      <div className={styles.msgHead}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={senderAvatarUrl(m)}
                          alt=""
                          className={styles.msgAvatar}
                        />
                        <span className={styles.msgSender}>{senderLabel(m)}</span>
                      </div>
                    )}
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
        </>
      )}
    </div>
  );
}

function EntranceScreen({ onEnter }: { onEnter: () => void }) {
  return (
    <div className={styles.entrance}>
      <div className={styles.entranceIcon} aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 9a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-9l-6 5v-5H8a3 3 0 0 1-3-3V9z" />
          <path d="M10 13h12M10 16.5h8" />
        </svg>
      </div>
      <h3 className={styles.entranceTitle}>Sala global de fãs</h3>
      <p className={styles.entranceLead}>
        Aqui todo mundo que usa o muusic conversa junto. Comente uma música,
        fala do show, descubra quem tá ouvindo o mesmo que você.
      </p>
      <ul className={styles.entranceRules}>
        <li>Sem moderação automática — seja gente boa.</li>
        <li>Seu nome de perfil e foto aparecem nas mensagens.</li>
        <li>Mensagens são públicas pra todos os usuários logados.</li>
      </ul>
      <button type="button" className={styles.entranceBtn} onClick={onEnter}>
        Entrar no Superchat
      </button>
    </div>
  );
}
