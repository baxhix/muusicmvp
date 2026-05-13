'use client';

import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { useSuperchat, type SuperchatFeedItem } from '@/hooks/useSuperchat';
import { useAuth } from '@/lib/auth/AuthContext';
import type { ApiMessage } from '@/lib/api/types';
import ParticipantsModal from './ParticipantsModal';
import MessageBody from './MessageBody';
import styles from './SuperchatPanel.module.css';

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
  return m.senderAvatarUrl ?? `https://i.pravatar.cc/72?u=${m.senderId}`;
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
  const [showParticipants, setShowParticipants] = useState(false);
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
                src={p.avatarUrl ?? `https://i.pravatar.cc/72?u=${p.id}`}
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
              feed.map((item, i) => renderItem(item, i, feed, user.id, react))
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

      <ParticipantsModal
        open={showParticipants}
        onClose={() => setShowParticipants(false)}
      />
    </div>
  );
}

function renderItem(
  item: SuperchatFeedItem,
  i: number,
  feed: SuperchatFeedItem[],
  myUserId: string,
  onReact: (messageId: string, emoji: string) => void,
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
  const prev = i > 0 ? feed[i - 1] : null;
  const prevSameSender =
    prev && prev._type === 'message' && prev.senderId === m.senderId;
  const showHead = !isMine && !prevSameSender;

  return (
    <MessageRow
      key={m.id}
      m={m}
      isMine={isMine}
      showHead={showHead}
      onReact={onReact}
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
}: {
  m: ApiMessage;
  isMine: boolean;
  showHead: boolean;
  onReact: (messageId: string, emoji: string) => void;
}) {
  const reactions = m.reactions ?? [];
  const reactedEmojis = new Set(reactions.map((r) => r.emoji));
  const pickerOptions = QUICK_REACTIONS.filter((e) => !reactedEmojis.has(e));

  // Picker visibility: hidden by default, toggled by the "+" button.
  // Persistent state per message so each conversation row keeps track
  // of its own popover independently.
  const [pickerOpen, setPickerOpen] = useState(false);
  const reactBarRef = useRef<HTMLDivElement | null>(null);

  // Click-outside closes the picker. Listen on the document while
  // open; tear down on close to keep us off the event hot-path when
  // nothing's expanded.
  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (reactBarRef.current?.contains(e.target as Node)) return;
      setPickerOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={senderAvatarUrl(m)} alt="" className={styles.msgAvatar} />
          <span className={styles.msgSender}>{senderLabel(m)}</span>
        </div>
      )}

      <div className={styles.bubbleWrap}>
        <div className={styles.bubble} style={bubbleStyle}>
          <MessageBody body={m.body} maxPreviewWidth={360} />
        </div>
      </div>

      {/* Reactions bar
       * - Chips for reactions ALREADY made are persistent — count +
       *   emoji visible at all times so anyone can see who reacted
       *   with what without interacting (WhatsApp/Slack/Discord).
       * - The 6-emoji picker is gated behind a small "+" affordance
       *   so the bar stays compact when no one's reacted yet, and
       *   doesn't blast the user with all six options upfront.
       * - Click-outside closes the picker; the bar itself is a click
       *   sanctuary so chip toggles don't auto-close it. */}
      <div
        ref={reactBarRef}
        className={`${styles.reactBar} ${isMine ? styles.reactBarOut : styles.reactBarIn}`}
      >
        {reactions.map((r) => (
          <button
            key={r.emoji}
            type="button"
            className={`${styles.reactChip} ${r.mine ? styles.reactChipMine : ''}`}
            onClick={() => onReact(m.id, r.emoji)}
            aria-label={`${r.emoji} ${r.count} ${r.mine ? '(você reagiu)' : ''}`}
            aria-pressed={r.mine}
            title={`${r.count} ${r.count === 1 ? 'pessoa reagiu' : 'pessoas reagiram'}`}
          >
            <span className={styles.reactChipEmoji}>{r.emoji}</span>
            <span className={styles.reactChipCount}>{r.count}</span>
          </button>
        ))}
        {pickerOptions.length > 0 && (
          <button
            type="button"
            className={`${styles.reactChip} ${styles.reactAddBtn} ${pickerOpen ? styles.reactAddBtnOpen : ''}`}
            onClick={() => setPickerOpen((v) => !v)}
            aria-label="Adicionar reação"
            aria-expanded={pickerOpen}
            title="Adicionar reação"
          >
            {pickerOpen ? '×' : '+'}
          </button>
        )}
        {pickerOpen && pickerOptions.length > 0 && (
          <div
            className={`${styles.reactPickerPopover} ${isMine ? styles.reactPickerPopoverOut : styles.reactPickerPopoverIn}`}
            role="toolbar"
            aria-label="Escolher reação"
          >
            {pickerOptions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={styles.reactPickerBtn}
                onClick={() => {
                  onReact(m.id, emoji);
                  setPickerOpen(false);
                }}
                aria-label={`Reagir com ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

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
