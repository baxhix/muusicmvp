'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useSuperchat, type SuperchatFeedItem } from '@/hooks/useSuperchat';
import { useAuth } from '@/lib/auth/AuthContext';
import type { ApiMessage } from '@/lib/api/types';
import ParticipantsModal from './ParticipantsModal';
import MessageBody, { buildReplyBody, stripReplyPrefix } from './MessageBody';
import styles from './SuperchatPanel.module.css';
import RankMedallion from './RankMedallion';
import { useRankBands } from './RankBandsProvider';

/** Auto-resize do textarea: cresce com o conteúdo até MAX_PX, depois
 *  scroll interno. Reseta height pra `auto` antes de medir
 *  scrollHeight pra que encolha quando o user apaga linhas. */
const MAX_SUPERCHAT_TEXTAREA_PX = 120;
function autoResizeChat(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, MAX_SUPERCHAT_TEXTAREA_PX)}px`;
}

/** Pointer to the message currently being replied to. The actual
 *  quote is materialized at SEND time by buildReplyBody(). */
interface ReplyTarget {
  senderName: string;
  body: string;
}

interface SuperchatPanelProps {
  open: boolean;
  onClose: () => void;
  onMarkRead?: () => void;
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
  return m.senderAvatarUrl ?? '/avatar-placeholder.svg';
}

/**
 * Picks a deterministic gradient pair for a user's bubbles. Ten gradients
 * spaced around the color wheel — each goes between two adjacent hues of
 * the same darkness band (Tailwind 600↔700) so the gradient adds depth
 * without floating into bright shades that lose AA contrast against
 * white text. Every endpoint passes ≥ 4.5:1 with white.
 *
 * Hash → index keeps the same user on the same gradient across re-renders
 * and across reloads, so reading flow stays predictable.
 */
const USER_BUBBLE_PALETTE: Array<{ from: string; to: string }> = [
  { from: '#4F46E5', to: '#7C3AED' }, // indigo → violet
  { from: '#2563EB', to: '#4F46E5' }, // blue → indigo
  { from: '#0284C7', to: '#2563EB' }, // sky → blue
  { from: '#0F766E', to: '#047857' }, // teal → emerald
  { from: '#15803D', to: '#0F766E' }, // green → teal
  { from: '#4D7C0F', to: '#15803D' }, // lime → green
  { from: '#B45309', to: '#B91C1C' }, // amber → red
  { from: '#DC2626', to: '#BE185D' }, // red → pink
  { from: '#DB2777', to: '#A21CAF' }, // pink → fuchsia
  { from: '#7C3AED', to: '#A21CAF' }, // violet → fuchsia
];

function gradientForUserId(userId: string): { from: string; to: string } {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) & 0xffff;
  }
  return USER_BUBBLE_PALETTE[h % USER_BUBBLE_PALETTE.length];
}

export default function SuperchatPanel({ open, onClose, onMarkRead }: SuperchatPanelProps) {
  const { user } = useAuth();

  // 'joined' persisted in localStorage so the entrance screen only shows
  // on the very first interaction.
  const [joined, setJoined] = useState(false);
  useEffect(() => {
    try {
      setJoined(localStorage.getItem(JOINED_KEY) === '1');
    } catch {
      setJoined(false);
    }
  }, []);

  const { feed, send, react, loading, participantCount, participantPreviews } =
    useSuperchat(open && joined);

  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feed.length]);

  // Stable ref so the mark-read effect below doesn't re-run just because
  // the parent recreated the onMarkRead callback. Without this, a fresh
  // closure every parent render would retrigger the effect → markRead →
  // setState → parent re-render → infinite loop.
  const onMarkReadRef = useRef(onMarkRead);
  useEffect(() => {
    onMarkReadRef.current = onMarkRead;
  }, [onMarkRead]);

  useEffect(() => {
    if (!open || !joined) return;
    onMarkReadRef.current?.();
  }, [open, joined, feed.length]);

  const handleEnter = () => {
    try {
      localStorage.setItem(JOINED_KEY, '1');
    } catch {
      // ignore
    }
    setJoined(true);
  };

  const onSubmit = () => {
    const text = draft.trim();
    if (!text) return;
    // Wrap with the shared reply-prefix format so the renderer
    // shows the quoted block for every viewer, same UX as DMs.
    const body = replyingTo
      ? buildReplyBody(replyingTo.senderName, replyingTo.body, text)
      : text;
    send(body);
    setDraft('');
    setReplyingTo(null);
    /* Reseta a altura do textarea — senão fica esticado mesmo
     * com draft vazio depois de mandar mensagem multi-linha. */
    requestAnimationFrame(() => autoResizeChat(inputRef.current));
  };

  const onReplyTo = (m: ApiMessage) => {
    // Skip chained-reply accumulation: only quote the most-recent
    // bubble's actual body, not whatever it was replying to.
    setReplyingTo({
      senderName: m.senderName ?? m.senderEmail ?? 'Mensagem',
      body: stripReplyPrefix(m.body),
    });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
    /* Shift+Enter cai pro default do textarea: insere \n. Sem
     * preventDefault, o browser faz o trabalho. */
  };

  if (!user) return null;

  return (
    <div
      className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
      role="dialog"
      aria-label="Superchat"
    >
      <header className={styles.header}>
        <h2 className={styles.title}>Superchat</h2>
        {joined && participantCount > 0 && (
          <button
            type="button"
            className={styles.participantsStack}
            onClick={() => setShowParticipants(true)}
            aria-label={`Ver ${participantCount} ${participantCount === 1 ? 'participante' : 'participantes'}`}
            title={`${participantCount} ${participantCount === 1 ? 'participante' : 'participantes'}`}
          >
            {participantPreviews.slice(0, 5).map((p, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={p.id}
                src={p.avatarUrl ?? '/avatar-placeholder.svg'}
                alt={p.name ?? ''}
                className={styles.participantsAvatar}
                style={{ ['--i' as string]: i } as React.CSSProperties}
              />
            ))}
            {participantCount > participantPreviews.length && (
              <span
                className={styles.participantsMore}
                style={{ ['--i' as string]: participantPreviews.slice(0, 5).length } as React.CSSProperties}
              >
                +{participantCount - participantPreviews.slice(0, 5).length}
              </span>
            )}
          </button>
        )}
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

      {!joined ? (
        <EntranceScreen onEnter={handleEnter} />
      ) : (
        <>
          <div className={styles.messages}>
            {loading && feed.length === 0 ? (
              <div className={styles.placeholder}>Carregando…</div>
            ) : feed.length === 0 ? (
              <div className={styles.placeholder}>Seja o primeiro a mandar uma mensagem 👋</div>
            ) : (
              renderFeedWithDaySeparators(feed, user.id, react, onReplyTo)
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
            <textarea
              ref={inputRef}
              className={styles.field}
              placeholder={replyingTo ? 'Sua resposta…' : 'Manda essa pra galera…'}
              autoComplete="off"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                autoResizeChat(e.currentTarget);
              }}
              onKeyDown={onKey}
              maxLength={4000}
              rows={1}
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

      <ParticipantsModal
        open={showParticipants}
        onClose={() => setShowParticipants(false)}
      />
    </div>
  );
}

/** Stable per-day cache key. Identical helpers ship in LiveChatPanel —
 *  duplicated rather than shared because they're literally three lines
 *  and the chat panels don't have a common module yet. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** "Hoje" / "Ontem" / formatted PT-BR date. Same UX language as the
 *  DM panel so the two chats feel like one product. */
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

/** Iterate the feed once, emitting a day-separator chip every time
 *  the calendar day changes between consecutive items. Used in place
 *  of the previous `feed.map` so both message + activity rows get
 *  grouped by date. */
function renderFeedWithDaySeparators(
  feed: SuperchatFeedItem[],
  myUserId: string,
  onReact: (messageId: string, emoji: string) => void,
  onReplyTo: (m: ApiMessage) => void,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastDay: string | null = null;
  for (let i = 0; i < feed.length; i++) {
    const item = feed[i];
    const k = dayKey(item.createdAt);
    if (k !== lastDay) {
      nodes.push(
        <div key={`day-${k}-${item.id}`} className={styles.daySeparator}>
          <span>{formatDayLabel(item.createdAt)}</span>
        </div>,
      );
      lastDay = k;
    }
    nodes.push(renderItem(item, i, feed, myUserId, onReact, onReplyTo));
  }
  return nodes;
}

function renderItem(
  item: SuperchatFeedItem,
  i: number,
  feed: SuperchatFeedItem[],
  myUserId: string,
  onReact: (messageId: string, emoji: string) => void,
  onReplyTo: (m: ApiMessage) => void,
) {
  if (item._type === 'activity') {
    return (
      <div key={item.id} className={styles.activity}>
        <span className={styles.activityIcon} aria-hidden="true">♪</span>
        <span className={styles.activityText}>
          <strong>{item.userName ?? 'Alguém'}</strong> tocou{' '}
          <em>{item.trackTitle}</em>
          {item.trackArtist ? ` — ${item.trackArtist}` : ''}{' '}
          <span className={styles.activityPoints}>+{item.points} pts</span>
        </span>
      </div>
    );
  }

  // It's a message — delegate to MessageRow which owns the picker
  // hover/open state so each row maintains its own affordance state.
  const m = item;
  const isMine = m.senderId === myUserId;
  // Per product feedback "não está sendo mostrado o nome, nem
  // avatar do usuário que enviou": o Superchat agora exibe o
  // cabeçalho (avatar + nome) em TODA mensagem de outro usuário,
  // sem colapsar runs consecutivos. O room é vibrante e ter o
  // rosto/nome ao lado de cada bubble reforça a identidade do
  // fã na conversa coletiva — diferente do DM (LiveChatPanel),
  // onde só dois interlocutores conversam e a repetição
  // pesava. Mantém oculto pras mensagens do próprio usuário
  // (right-alignment já marca a autoria).
  const showHead = !isMine;

  return (
    <MessageRow
      key={m.id}
      m={m}
      isMine={isMine}
      showHead={showHead}
      onReact={onReact}
      onReplyTo={onReplyTo}
    />
  );
}

/* ── Reactions ─────────────────────────────────────────────── */

/** Curated set of quick-pick reactions shown in the hover picker. */
const QUICK_REACTIONS = ['❤️', '🔥', '😂', '👍', '😮', '😢'] as const;

function MessageRow({
  m,
  isMine,
  showHead,
  onReact,
  onReplyTo,
}: {
  m: ApiMessage;
  isMine: boolean;
  showHead: boolean;
  onReact: (messageId: string, emoji: string) => void;
  onReplyTo: (m: ApiMessage) => void;
}) {
  const reactions = m.reactions ?? [];
  const { rankOf } = useRankBands();

  // Picker visibility per row. Hover shows the smile + reply
  // buttons; clicking smile toggles the emoji picker popover.
  // Persistent per-row state so each message tracks its own.
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // Click-outside / Escape closes the picker — matches DM panel UX.
  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (pickerRef.current?.contains(e.target as Node)) return;
      setPickerOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  // Outgoing messages render naked text on the panel — no bubble bg at
  // all. Incoming messages get a vibrant 135deg gradient drawn from
  // USER_BUBBLE_PALETTE keyed on the senderId.
  const bubbleStyle = isMine
    ? undefined
    : (() => {
        const g = gradientForUserId(m.senderId);
        return {
          background: `linear-gradient(135deg, ${g.from} 0%, ${g.to} 100%)`,
          color: '#FFFFFF',
        };
      })();

  return (
    <div className={`${styles.msg} ${isMine ? styles.msgOut : styles.msgIn}`}>
      {showHead && (
        <div className={styles.msgHead}>
          <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={senderAvatarUrl(m)} alt="" className={styles.msgAvatar} />
            <RankMedallion position={rankOf(m.senderId)} size="sm" />
          </span>
          <span className={styles.msgSender}>{senderLabel(m)}</span>
        </div>
      )}

      {/* Bubble + hover actions row — actions live on the OUTSIDE
          edge of the bubble (right for incoming, left for outgoing)
          so they don't crowd the timestamp below. Same layout +
          interaction model as LiveChatPanel. */}
      <div className={styles.bubbleRow}>
        <div className={styles.bubble} style={bubbleStyle}>
          <MessageBody body={m.body} maxPreviewWidth={360} />
        </div>

        <span className={styles.msgActions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => onReplyTo(m)}
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
            onClick={() => setPickerOpen((v) => !v)}
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
            {QUICK_REACTIONS.map((emoji) => {
              const mineAlready = reactions.some(
                (r) => r.emoji === emoji && r.mine,
              );
              return (
                <button
                  key={emoji}
                  type="button"
                  role="menuitem"
                  className={`${styles.reactPickerItem} ${mineAlready ? styles.reactPickerItemActive : ''}`}
                  onClick={() => {
                    onReact(m.id, emoji);
                    setPickerOpen(false);
                  }}
                  aria-label={`Reagir com ${emoji}`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Aggregated reaction badges — slim pill per emoji, anchored
          to the bubble side (right for outgoing, left for incoming).
          Click toggles the current user's reaction for that emoji. */}
      {reactions.length > 0 && (
        <div className={styles.reactionBadgeRow}>
          {reactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              className={`${styles.reactionBadge} ${r.mine ? styles.reactionBadgeMine : ''}`}
              onClick={() => onReact(m.id, r.emoji)}
              aria-label={`${r.emoji} ${r.count} ${r.mine ? '(você reagiu)' : ''}`}
              aria-pressed={r.mine}
              title={`${r.count} ${r.count === 1 ? 'pessoa reagiu' : 'pessoas reagiram'}`}
            >
              <span>{r.emoji}</span>
              {r.count > 1 && (
                <span className={styles.reactionBadgeCount}>{r.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className={styles.time}>{formatTime(m.createdAt)}</div>
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
