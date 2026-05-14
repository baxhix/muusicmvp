'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { ApiConversationSummary, ApiMessage } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import MessageBody, { buildReplyBody, stripReplyPrefix } from './MessageBody';
import VerifiedBadge from './VerifiedBadge';
import ReportModal from './ReportModal';
import MentionAutocomplete from './MentionAutocomplete';
import {
  useConversationMembers,
  type MentionableMember,
} from '@/hooks/useConversationMembers';
import { useAuth as useAuthCtx } from '@/lib/auth/AuthContext';
import styles from './LiveChatPanel.module.css';

/** Block-user remains stubbed — the /api/block endpoint doesn't exist
 *  yet. Reporting (above) is wired to real /api/reports. */
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
  /** Toggle a reaction emoji on a message. Server-persisted via socket. */
  onReact: (messageId: string, emoji: string) => void;
  /** Fired from the kebab menu when the user clicks "Ver membros"
   *  in a group conversation. Parent should open GroupMembersPanel. */
  onOpenMembers?: () => void;
  /** Fired from the kebab menu when the user clicks "Sair do
   *  grupo". Parent should open a confirm + call the DELETE
   *  /members/:userId endpoint. */
  onLeaveGroup?: () => void;
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
  onReact,
  onOpenMembers,
  onLeaveGroup,
}: Props) {
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  // @mention autocomplete state. `mentionStart` is the cursor
  // position where the active "@" sits; null means no autocomplete
  // is open right now. `mentionQuery` is the text typed AFTER the
  // "@" — used to filter the suggestions. `pickedMentions` accumu-
  // lates user picks so we can serialize them into the canonical
  // @[name](uuid) format at send time.
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [pickedMentions, setPickedMentions] = useState<MentionableMember[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user: authUser } = useAuthCtx();
  const mentionMembers = useConversationMembers(
    conversation ?? null,
    authUser?.id ?? null,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpenId, setPickerOpenId] = useState<string | null>(null);
  // Pointer to the message currently being replied to. Lives in
  // component state — the actual quote is materialized at SEND time
  // by wrapping the body via buildReplyBody().
  const [replyingTo, setReplyingTo] = useState<{
    senderName: string;
    body: string;
  } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
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
  // kebab menu / picker / reply target so they don't leak across
  // threads. Reactions themselves are server-persisted (m.reactions),
  // no local store to clear here.
  useEffect(() => {
    setMenuOpen(false);
    setPickerOpenId(null);
    setReplyingTo(null);
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
    onReact(msgId, emoji);
    setPickerOpenId(null);
  };

  /** Convert each picked mention's "@Display" occurrence in the
   *  draft body into the canonical "@[Display](uuid)" form. Done
   *  at send time so the input itself stays human-readable while
   *  the user composes. Stale picks (display name removed from
   *  input by the user) just don't match anything — harmless. */
  const serializeMentions = (text: string): string => {
    let out = text;
    for (const m of pickedMentions) {
      const display = m.name ?? m.email.split('@')[0] ?? 'usuário';
      // Word-boundary-ish replace — avoid matching @João inside
      // @Joãotruck. Surround the match with a non-word lookahead.
      const re = new RegExp(
        `@${display.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?!\\w)`,
        'g',
      );
      out = out.replace(re, `@[${display}](${m.id})`);
    }
    return out;
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    const mentioned = serializeMentions(text);
    // If the user is replying to a message, wrap the body in the
    // shared reply-prefix format BEFORE sending so both sides see
    // the same quoted preview when MessageBody renders it.
    const body = replyingTo
      ? buildReplyBody(replyingTo.senderName, replyingTo.body, mentioned)
      : mentioned;
    setDraft('');
    setReplyingTo(null);
    setPickedMentions([]);
    setMentionStart(null);
    setMentionQuery('');
    await onSend(body);
  };

  /** Inspect the input value + caret position to decide whether the
   *  mention autocomplete should be open. We open when there's an
   *  unfinished "@" token immediately to the left of the caret
   *  (i.e. no whitespace between the "@" and the caret). */
  const updateMentionState = (value: string, caret: number) => {
    // Walk backwards from the caret to find a recent "@" or break.
    let i = caret - 1;
    while (i >= 0) {
      const ch = value[i];
      if (ch === '@') {
        // Found a candidate "@". It must be at the start OR
        // preceded by whitespace to count as a fresh trigger
        // (so emails like "marcelo@host" don't open it).
        const prev = i === 0 ? ' ' : value[i - 1];
        if (/\s/.test(prev)) {
          setMentionStart(i);
          setMentionQuery(value.slice(i + 1, caret));
          return;
        }
        break;
      }
      if (/\s/.test(ch)) break;
      i--;
    }
    setMentionStart(null);
    setMentionQuery('');
  };

  const handleDraftChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDraft(value);
    updateMentionState(value, e.target.selectionStart ?? value.length);
  };

  const handlePickMention = (m: MentionableMember) => {
    if (mentionStart === null || !inputRef.current) return;
    const display = m.name ?? m.email.split('@')[0] ?? 'usuário';
    const before = draft.slice(0, mentionStart);
    const afterCaret = draft.slice(
      inputRef.current.selectionStart ?? draft.length,
    );
    // Always trailing space so the next thing the user types is
    // separated from the mention. Caret jumps to right after it.
    const inserted = `@${display} `;
    const nextValue = `${before}${inserted}${afterCaret}`;
    setDraft(nextValue);
    setPickedMentions((cur) =>
      cur.find((x) => x.id === m.id) ? cur : [...cur, m],
    );
    setMentionStart(null);
    setMentionQuery('');
    // Restore focus + put caret right after the inserted mention.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const pos = before.length + inserted.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Mention autocomplete consumes Enter to pick the highlight.
      // Don't submit while it's open — its global keydown listener
      // already called preventDefault on this Enter.
      if (mentionStart !== null) return;
      e.preventDefault();
      submit();
    }
  };

  const isGroup = conversation?.type === 'group';
  const other = conversation?.otherUser;
  // Display identity is shape-dependent:
  //   DM    → conversation.otherUser.{name,avatar,verified}
  //   Group → conversation.{name,imageUrl} (no verified concept)
  const headerName = isGroup
    ? (conversation?.name ?? 'Grupo')
    : (other?.name ?? 'Conversa');
  const seedId = isGroup ? (conversation?.id ?? 'unknown') : (other?.id ?? 'unknown');
  const avatar = isGroup
    ? (conversation?.imageUrl ?? `https://i.pravatar.cc/96?u=${seedId}`)
    : (other?.avatarUrl ?? (other ? `https://i.pravatar.cc/72?u=${other.id}` : null));
  const isVerified = !isGroup && !!other?.verified;
  // Resolve the now-playing line: real data from the parent if the
  // user is online and listening to something, else a deterministic
  // mock so the slot never reads as "empty". Skipped entirely for
  // groups — they don't have a single "now playing".
  const nowPlaying: ChatNowPlaying | null = !isGroup && other
    ? otherNowPlaying ?? pickMockTrack(other.id)
    : null;
  // Member count fallback line for groups — replaces the now-playing
  // slot so the header has something below the name.
  const memberCountLine = isGroup
    ? `${conversation?.memberCount ?? 0} ${(conversation?.memberCount ?? 0) === 1 ? 'membro' : 'membros'}`
    : null;

  return (
    <div
      className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
      role="dialog"
      aria-label={`Chat com ${headerName}`}
    >
      <div className={styles.header}>
        {avatar && (
          <span className={styles.headerAvatarWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatar}
              alt={headerName}
              className={`${styles.headerAvatar} ${isGroup ? styles.headerAvatarGroup : ''}`}
              onError={(e) => {
                // 404? Fall back to deterministic pravatar so the chat
                // header doesn't render with a broken-image icon. Same
                // resilience pattern as the dock + sidebar.
                const img = e.currentTarget;
                const fb = `https://i.pravatar.cc/96?u=${seedId}`;
                if (img.src !== fb) img.src = fb;
              }}
            />
            {isVerified && (
              <span className={styles.headerVerified}>
                <VerifiedBadge size={20} />
              </span>
            )}
          </span>
        )}
        <div className={styles.headerInfo}>
          <span className={styles.headerName}>
            {headerName}
            {isVerified && (
              <VerifiedBadge size={16} className={styles.headerInlineVerified} />
            )}
          </span>
          {/* DMs: now-playing line (track + artist).
              Groups: member count instead — same slot, different
              content, identical typography hierarchy so the header
              footprint stays consistent across both shapes. */}
          {nowPlaying ? (
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
          ) : memberCountLine ? (
            <span className={styles.headerNowPlaying}>
              <span className={styles.headerTrackArtist}>
                {memberCountLine}
              </span>
            </span>
          ) : null}
        </div>

        {/* Kebab menu — content depends on conversation type:
            - DM:    Denunciar / Bloquear usuário
            - Group: Ver membros / Sair / (Excluir if owner)
            Both flows share the same floating-menu UX. */}
        {(other || isGroup) && (
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
                {isGroup ? (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.kebabItem}
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenMembers?.();
                      }}
                    >
                      Ver membros
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={`${styles.kebabItem} ${styles.kebabItemDanger}`}
                      onClick={() => {
                        setMenuOpen(false);
                        onLeaveGroup?.();
                      }}
                    >
                      Sair do grupo
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.kebabItem}
                      onClick={() => {
                        setMenuOpen(false);
                        setReportOpen(true);
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
                        if (other) blockUser(other.id, other.name ?? null);
                      }}
                    >
                      Bloquear usuário
                    </button>
                  </>
                )}
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
              const msgReactions = m.reactions ?? [];
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

                    {/* Hover actions — reaction trigger + reply
                        button. Both fade in on bubble hover. The
                        reply button captures the original message
                        (after stripping any existing reply prefix
                        so chained replies only quote the latest)
                        and focuses the input. */}
                    <span className={styles.msgActions}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => {
                          const senderName = isMine
                            ? 'Você'
                            : other?.name ?? 'Conversa';
                          setReplyingTo({
                            senderName,
                            body: stripReplyPrefix(m.body),
                          });
                        }}
                        aria-label="Responder à mensagem"
                        title="Responder"
                      >
                        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M9 4L4 9l5 5" />
                          <path d="M4 9h7a3 3 0 0 1 3 3v0" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtn}
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
                    </span>

                    {pickerOpen && (
                      <div className={styles.reactPicker} ref={pickerRef} role="menu">
                        {REACTION_EMOJIS.map((e) => {
                          const mineAlready = msgReactions.some(
                            (r) => r.emoji === e && r.mine,
                          );
                          return (
                            <button
                              key={e}
                              type="button"
                              role="menuitem"
                              className={`${styles.reactPickerItem} ${mineAlready ? styles.reactPickerItemActive : ''}`}
                              onClick={() => toggleReaction(m.id, e)}
                              aria-label={`Reagir com ${e}`}
                            >
                              {e}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Aggregated reaction badges — one chip per emoji,
                      mine-styled when the user is among the reactors.
                      Counts hidden when 1 (DM = mostly 1:1 reactions
                      anyway). Click toggles your own contribution. */}
                  {msgReactions.length > 0 && (
                    <div className={styles.reactionBadgeRow}>
                      {msgReactions.map((r) => (
                        <button
                          key={r.emoji}
                          type="button"
                          className={`${styles.reactionBadge} ${r.mine ? styles.reactionBadgeMine : ''}`}
                          onClick={() => toggleReaction(m.id, r.emoji)}
                          aria-label={`${r.emoji} ${r.count}${r.mine ? ' (você reagiu)' : ''}`}
                          aria-pressed={r.mine}
                        >
                          <span aria-hidden="true">{r.emoji}</span>
                          {r.count > 1 && (
                            <span className={styles.reactionBadgeCount}>{r.count}</span>
                          )}
                        </button>
                      ))}
                    </div>
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

      {replyingTo && (
        <div className={styles.replyBanner}>
          <div className={styles.replyBannerBar} aria-hidden="true" />
          <div className={styles.replyBannerInfo}>
            <span className={styles.replyBannerSender}>
              Respondendo a {replyingTo.senderName}
            </span>
            <span className={styles.replyBannerText}>{replyingTo.body}</span>
          </div>
          <button
            type="button"
            className={styles.replyBannerClose}
            onClick={() => setReplyingTo(null)}
            aria-label="Cancelar resposta"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <div className={styles.inputArea}>
        {/* Mention autocomplete — anchored above this input area.
            Only rendered when the user has an active "@" trigger
            in the draft (mentionStart !== null). */}
        {mentionStart !== null && (
          <MentionAutocomplete
            members={mentionMembers}
            query={mentionQuery}
            onPick={handlePickMention}
            onClose={() => {
              setMentionStart(null);
              setMentionQuery('');
            }}
          />
        )}

        <input
          ref={inputRef}
          className={styles.field}
          placeholder={replyingTo ? 'Sua resposta…' : 'Mensagem…'}
          autoComplete="off"
          value={draft}
          onChange={handleDraftChange}
          onSelect={(e) => {
            // Selection change (cursor moved without value change)
            // — re-evaluate whether we should still be showing the
            // mention popover for the new caret position.
            const el = e.currentTarget;
            updateMentionState(el.value, el.selectionStart ?? el.value.length);
          }}
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

      {/* Report modal — mounted at the panel root so the scrim covers
          everything. `targetUserId` is the OTHER user in this DM. */}
      {other && (
        <ReportModal
          open={reportOpen}
          targetUserId={other.id}
          targetName={other.name ?? null}
          source="chat_user"
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
