'use client';

import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { useSuperchat, type SuperchatFeedItem } from '@/hooks/useSuperchat';
import { useAuth } from '@/lib/auth/AuthContext';
import type { ApiMessage } from '@/lib/api/types';
import ParticipantsModal from './ParticipantsModal';
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
 * Picks a deterministic muted accent color for a user's bubbles. Drawn
 * from a small curated palette — all paired with white text and a tint
 * of black on top of the bubble bg to keep contrast high.
 *
 * Hash → index keeps the same user on the same color across re-renders
 * and across reloads, so reading flow stays predictable.
 */
const USER_BUBBLE_PALETTE = [
  '#314D7A', // azul desbotado
  '#4B3A77', // roxo discreto
  '#3A6E51', // verde acinzentado
  '#7A4E3A', // marrom suave
  '#6E3F5A', // rosé
  '#3A6E6E', // teal
  '#6E6238', // mostarda
  '#4A3A66', // ametista
  '#4E5E3A', // oliva
  '#5E3A52', // bordô
];

function colorForUserId(userId: string): string {
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

  const { feed, send, loading, participantCount } = useSuperchat(open && joined);

  const [draft, setDraft] = useState('');
  const [showParticipants, setShowParticipants] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feed.length]);

  useEffect(() => {
    if (!open || !joined) return;
    onMarkRead?.();
  }, [open, joined, feed.length, onMarkRead]);

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
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleText}>Superchat</span>
          {joined && (
            <button
              type="button"
              className={styles.participantsLink}
              onClick={() => setShowParticipants(true)}
              aria-label={`Ver ${participantCount} participantes`}
            >
              {participantCount} {participantCount === 1 ? 'participante' : 'participantes'}
            </button>
          )}
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
            {loading && feed.length === 0 ? (
              <div className={styles.placeholder}>Carregando…</div>
            ) : feed.length === 0 ? (
              <div className={styles.placeholder}>Seja o primeiro a mandar uma mensagem 👋</div>
            ) : (
              feed.map((item, i) => renderItem(item, i, feed, user.id))
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

  // It's a message.
  const m = item;
  const isMine = m.senderId === myUserId;
  const prev = i > 0 ? feed[i - 1] : null;
  const prevSameSender =
    prev && prev._type === 'message' && prev.senderId === m.senderId;
  const showHead = !isMine && !prevSameSender;

  const bubbleColor = isMine ? undefined : colorForUserId(m.senderId);

  return (
    <div
      key={m.id}
      className={`${styles.msg} ${isMine ? styles.msgOut : styles.msgIn}`}
    >
      {showHead && (
        <div className={styles.msgHead}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={senderAvatarUrl(m)} alt="" className={styles.msgAvatar} />
          <span className={styles.msgSender}>{senderLabel(m)}</span>
        </div>
      )}
      <div
        className={styles.bubble}
        style={bubbleColor ? { background: bubbleColor, color: '#FFFFFF' } : undefined}
      >
        {m.body}
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
