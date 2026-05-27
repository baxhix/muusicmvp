'use client';

import { memo } from 'react';
import type { ApiMessage, ApiMessageReaction } from '@/lib/api/types';
import MessageBody, { stripReplyPrefix } from './MessageBody';
import styles from './LiveChatPanel.module.css';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

interface Props {
  message: ApiMessage;
  isMine: boolean;
  /** Hash da lista de reactions — usado como tie-breaker no
   *  React.memo. Sem isso, novas reactions vindas via socket não
   *  re-renderizavam a bubble (memo via reference equality do
   *  array `reactions` falhava). */
  reactionsKey: string;
  pickerOpen: boolean;
  /** Nome do "outro" lado da DM, pra preencher o sender name
   *  no banner de reply. Em group cair pra "Conversa" — fluxo
   *  de mention/reply é único nesse panel. */
  otherName: string | null | undefined;
  pickerRef: React.RefObject<HTMLDivElement | null>;
  onReply: (replyTo: { senderName: string; body: string }) => void;
  onTogglePicker: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
}

/**
 * Bubble individual de mensagem do user (kind === 'user'). System
 * events renderizam via `SystemMessagePill` em outro path.
 *
 * Memoizado por (id, reactionsKey, pickerOpen, isMine, otherName).
 * Sem o memo, o painel inteiro re-rendava a cada nova mensagem
 * recebida via socket — em grupos com 200+ messages na tela
 * ficava perceptivelmente travado no Safari mobile (audit P1.1).
 */
function MessageBubbleImpl({
  message: m,
  isMine,
  pickerOpen,
  otherName,
  pickerRef,
  onReply,
  onTogglePicker,
  onToggleReaction,
}: Props) {
  const msgReactions = m.reactions ?? [];

  return (
    <div className={`${styles.msg} ${isMine ? styles.msgOut : styles.msgIn}`}>
      <div className={styles.bubbleRow}>
        <div className={styles.bubble}>
          <MessageBody body={m.body} maxPreviewWidth={300} />
        </div>

        <span className={styles.msgActions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => {
              const senderName = isMine ? 'Você' : otherName ?? 'Conversa';
              onReply({
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
            onClick={() => onTogglePicker(m.id)}
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
                  onClick={() => onToggleReaction(m.id, e)}
                  aria-label={`Reagir com ${e}`}
                >
                  {e}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {msgReactions.length > 0 && (
        <div className={styles.reactionBadgeRow}>
          {msgReactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              className={`${styles.reactionBadge} ${r.mine ? styles.reactionBadgeMine : ''}`}
              onClick={() => onToggleReaction(m.id, r.emoji)}
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
    </div>
  );
}

/**
 * Hash estável de reactions pra equality check do memo. Serialização
 * curta (emoji+count+mine) — bate millis quando reactions mudam, mas
 * permanece estável quando não.
 */
export function hashReactions(reactions?: ApiMessageReaction[]): string {
  if (!reactions || reactions.length === 0) return '';
  return reactions
    .map((r) => `${r.emoji}:${r.count}:${r.mine ? '1' : '0'}`)
    .join('|');
}

/* React.memo compara props (shallow). Nossa props inclui callbacks
 * recebidos por reference — o parent precisa garantir que eles são
 * estáveis (useCallback). E `message` é a row inteira: como o parent
 * pode replace-via-patch o objeto inteiro mesmo quando nada relevante
 * mudou, fazemos custom equality. */
const MessageBubble = memo(MessageBubbleImpl, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.body === next.message.body &&
    prev.message.createdAt === next.message.createdAt &&
    prev.isMine === next.isMine &&
    prev.pickerOpen === next.pickerOpen &&
    prev.reactionsKey === next.reactionsKey &&
    prev.otherName === next.otherName &&
    prev.onReply === next.onReply &&
    prev.onTogglePicker === next.onTogglePicker &&
    prev.onToggleReaction === next.onToggleReaction
  );
});

export default MessageBubble;

/* SystemMessagePill — pílula cinza no centro para events de
 * sistema (criou o grupo / entrou / saiu). Renderizada num path
 * separado do MessageBubble pra evitar branching dentro da bubble
 * (sem msgActions, sem reactions, sem picker). */
interface SystemPillProps {
  who: string;
  verb: string;
}
export const SystemMessagePill = memo(function SystemMessagePillImpl({
  who,
  verb,
}: SystemPillProps) {
  return (
    <div className={styles.systemMsg}>
      <span className={styles.systemMsgPill}>
        <strong>{who}</strong> {verb}
      </span>
    </div>
  );
});
