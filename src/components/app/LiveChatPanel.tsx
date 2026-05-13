'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { ApiConversationSummary, ApiMessage } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import MessageBody from './MessageBody';
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

/** Shape of the now-playing line shown under the user's name in the
 *  chat header. When the parent doesn't have a live nowPlaying for
 *  the conversation partner, a deterministic mock is picked from
 *  MOCK_NOW_PLAYING (see below) so the slot is never empty. */
export interface ChatNowPlaying {
  title: string;
  artist: string;
}

interface Props {
  conversation: ApiConversationSummary | null;
  messages: ApiMessage[];
  loading: boolean;
  /** Optional live now-playing for the other user (from useLiveUsers). */
  otherNowPlaying?: ChatNowPlaying | null;
  onClose: () => void;
  onSend: (body: string) => Promise<void>;
}

/** Fallback now-playing pool — picked deterministically by hashing
 *  the conversation partner's id so each user always shows the same
 *  mock track. Used only when the live presence list doesn't carry
 *  a real now-playing for them. */
const MOCK_NOW_PLAYING: ChatNowPlaying[] = [
  { title: 'Pipoco', artist: 'Ana Castela, Melody, DJ Chris no Beat' },
  { title: 'Boiadeira', artist: 'Ana Castela' },
  { title: 'Solteiro Forçado', artist: 'Ana Castela' },
  { title: 'Nosso Quadro', artist: 'Ana Castela' },
  { title: 'Erro Gostoso', artist: 'Ana Castela' },
];

function pickMockTrack(userId: string): ChatNowPlaying {
  // Tiny deterministic hash → index. Same user always gets the same
  // mock track across reloads.
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % MOCK_NOW_PLAYING.length;
  return MOCK_NOW_PLAYING[idx];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/** Stable per-day cache key (year-month-day). Used to detect day
 *  boundaries while iterating messages so we can inject a separator
 *  above the first message of each new day. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** PT-BR-friendly day label — "Hoje", "Ontem", or a formatted date
 *  like "13 de mai" / "13 de mai de 2025". Year is dropped when the
 *  message falls in the current year. */
function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(d, now)) return 'Hoje';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) return 'Ontem';

  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

/** Emoji shortlist for the quick-react picker. Order matches the
 *  most-used set across chat apps (iMessage, WhatsApp, Slack tapback).
 *  Backend doesn't store reactions yet — these live in component
 *  state, keyed by message id. */
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

/**
 * 1-on-1 DM chat panel. Drives `useChatLive` (state owned by parent).
 * Slides in from the right when a conversation is open.
 */
export default function LiveChatPanel({
  conversation,
  messages,
  loading,
  otherNowPlaying,
  onClose,
  onSend,
}: Props) {
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  // Local reactions store: messageId → emoji (or null when cleared).
  // Stays client-side until the reactions API lands; switching
  // conversations resets it so we don't leak state across DMs.
  const [reactions, setReactions] = useState<Record<string, string | null>>({});
  const [pickerOpenId, setPickerOpenId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

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
  // target context. Also resets the reaction picker + local
  // reactions store so DMs don't leak each other's tapbacks.
  useEffect(() => {
    setMenuOpen(false);
    setPickerOpenId(null);
    setReactions({});
  }, [conversation?.id]);

  // Close the reaction picker on outside click / Escape, mirroring
  // the kebab menu's UX so both floating UIs feel consistent.
  useEffect(() => {
    if (!pickerOpenId) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpenId(null);
      }
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpenId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpenId]);

  const toggleReaction = (msgId: string, emoji: string) => {
    setReactions((cur) => ({
      ...cur,
      // Tapping the same emoji clears the reaction; tapping a
      // different one replaces it. One reaction per message per
      // user — matches iMessage tapback behavior.
      [msgId]: cur[msgId] === emoji ? null : emoji,
    }));
    setPickerOpenId(null);
  };

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
  // Resolve the now-playing line: real data from the parent if the
  // user is online and listening to something, else a deterministic
  // mock so the slot never reads as "empty". The slot itself is part
  // of the header's identity now — always visible when there's a
  // conversation open.
  const nowPlaying: ChatNowPlaying | null = other
    ? otherNowPlaying ?? pickMockTrack(other.id)
    : null;

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
          {/* Now-playing line: title in white-bold, artist in muted
              gray. Matches the same treatment used on the map pin
              preview so the user feels they're seeing the same data
              they would on the globe, just relocated into the chat. */}
          {nowPlaying && (
            <span className={styles.headerNowPlaying}>
              <svg
                className={styles.headerNoteIcon}
                viewBox="0 0 16 16"
                width="11"
                height="11"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M13 2.5v7.2a2.6 2.6 0 1 1-1.5-2.36V4.7L7 5.9v5.6a2.6 2.6 0 1 1-1.5-2.36V4.5L13 2.5z" />
              </svg>
              <span className={styles.headerTrackTitle}>{nowPlaying.title}</span>
              <span className={styles.headerTrackArtist}>{nowPlaying.artist}</span>
            </span>
          )}
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
          (() => {
            // Single pass that interleaves day separators with bubbles.
            // We track the last-rendered day key and emit a header
            // whenever it changes — including the very first message.
            const nodes: ReactNode[] = [];
            let lastDay: string | null = null;

            for (const m of messages) {
              const k = dayKey(m.createdAt);
              if (k !== lastDay) {
                nodes.push(
                  <div key={`day-${k}-${m.id}`} className={styles.daySeparator}>
                    <span>{formatDayLabel(m.createdAt)}</span>
                  </div>,
                );
                lastDay = k;
              }

              const isMine = m.senderId === user?.id;
              const myReaction = reactions[m.id] ?? null;
              const pickerOpen = pickerOpenId === m.id;

              nodes.push(
                <div
                  key={m.id}
                  className={`${styles.msg} ${isMine ? styles.msgOut : styles.msgIn}`}
                >
                  <div className={styles.bubbleRow}>
                    <div className={styles.bubble}>
                      <MessageBody body={m.body} maxPreviewWidth={300} />
                    </div>

                    {/* Reaction trigger — appears on hover (CSS-only
                        fade-in) and on tap opens the emoji picker.
                        Positioned on the OUTSIDE edge of the bubble
                        (right for incoming, left for outgoing) so
                        it doesn't crowd the message timestamp. */}
                    <button
                      type="button"
                      className={styles.reactBtn}
                      onClick={() =>
                        setPickerOpenId((cur) => (cur === m.id ? null : m.id))
                      }
                      aria-label="Reagir à mensagem"
                      aria-haspopup="menu"
                      aria-expanded={pickerOpen}
                    >
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <circle cx="8" cy="8" r="6.4" />
                        <circle cx="5.8" cy="6.6" r="0.7" fill="currentColor" />
                        <circle cx="10.2" cy="6.6" r="0.7" fill="currentColor" />
                        <path d="M5.6 10c.7.9 1.6 1.3 2.4 1.3.9 0 1.7-.4 2.4-1.3" strokeLinecap="round" />
                      </svg>
                    </button>

                    {pickerOpen && (
                      <div className={styles.reactPicker} ref={pickerRef} role="menu">
                        {REACTION_EMOJIS.map((e) => (
                          <button
                            key={e}
                            type="button"
                            role="menuitem"
                            className={`${styles.reactPickerItem} ${myReaction === e ? styles.reactPickerItemActive : ''}`}
                            onClick={() => toggleReaction(m.id, e)}
                            aria-label={`Reagir com ${e}`}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Reaction badge — only renders when the user has
                      picked an emoji. Sits BELOW the bubble, anchored
                      to the bubble side (right for outgoing, left for
                      incoming) so it visually attaches to the message
                      it belongs to. */}
                  {myReaction && (
                    <button
                      type="button"
                      className={styles.reactionBadge}
                      onClick={() => toggleReaction(m.id, myReaction)}
                      aria-label="Remover reação"
                      title="Tocar para remover"
                    >
                      <span aria-hidden="true">{myReaction}</span>
                    </button>
                  )}

                  <div className={styles.time}>{formatTime(m.createdAt)}</div>
                </div>,
              );
            }
            return nodes;
          })()
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
