'use client';

import { memo, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import type {
  ApiMessage,
  ApiMessageAttachment,
  ApiMessageReaction,
} from '@/lib/api/types';
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
  /** Renderiza header (avatar + nome) acima da bubble — mesmo
   *  padrão do SuperchatPanel. Drives pelo parent: em grupos,
   *  `showHead = !isMine` (msgs de outros recebem header pra
   *  identificar quem disse). Em DMs, sempre false (1:1 dispensa
   *  identidade). */
  showHead: boolean;
  /** Nome do "outro" lado da DM, pra preencher o sender name
   *  no banner de reply. Em group cair pra "Conversa" — fluxo
   *  de mention/reply é único nesse panel. */
  otherName: string | null | undefined;
  /** Permite apagar essa mensagem. Calculado no parent: true quando
   *  é a própria msg (DM/group) OU quando o user é owner do grupo.
   *  Servidor faz a checagem canônica — esse flag só drives a UI. */
  canDelete: boolean;
  pickerRef: React.RefObject<HTMLDivElement | null>;
  onReply: (replyTo: { senderName: string; body: string }) => void;
  onTogglePicker: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onDelete: (messageId: string) => void;
  /** Long-press handler — disparado depois de 500ms de toque parado na
   *  bubble. Em mobile (sem :hover), é o único caminho pra acessar
   *  responder/reagir/apagar. Parent abre um action sheet com as
   *  ações. */
  onLongPress: (messageId: string) => void;
}

/** Resolve o nome de quem mandou — prioridade: senderName hidratado
 *  pelo JOIN → local-part do email → "Anônimo". */
function senderLabel(m: ApiMessage): string {
  if (m.senderName?.trim()) return m.senderName.trim();
  if (m.senderEmail) return m.senderEmail.split('@')[0];
  return 'Anônimo';
}
function senderAvatar(m: ApiMessage): string {
  return m.senderAvatarUrl ?? '/avatar-placeholder.svg';
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
  showHead,
  otherName,
  canDelete,
  pickerRef,
  onReply,
  onTogglePicker,
  onToggleReaction,
  onDelete,
  onLongPress,
}: Props) {
  const msgReactions = m.reactions ?? [];

  /* Long-press detection — pattern padrão de mobile.
   *
   *  - touchstart inicia timer de 500ms + memoriza posição inicial
   *  - touchmove >10px em qualquer eixo cancela (era scroll, não hold)
   *  - touchend antes do timer cancela (tap normal)
   *  - timer dispara → fire callback + haptic feedback (vibrate 40ms)
   *
   *  `longPressFiredRef` é passado pro MessageAttachments pra suprimir
   *  o click do lightbox quando o long-press fechou em cima da imagem
   *  — sem isso, o touchend que vem após o disparo abriria o lightbox
   *  por trás do action sheet. */
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartPosRef.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    longPressFiredRef.current = false;
    const t = e.touches[0];
    longPressStartPosRef.current = { x: t.clientX, y: t.clientY };
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      longPressTimerRef.current = null;
      // Haptic — só dispara se o device suporta; desktop fica no-op.
      if (typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(40); } catch { /* ignore */ }
      }
      onLongPress(m.id);
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!longPressStartPosRef.current || !longPressTimerRef.current) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - longPressStartPosRef.current.x);
    const dy = Math.abs(t.clientY - longPressStartPosRef.current.y);
    if (dx > 10 || dy > 10) clearLongPressTimer();
  };

  const handleTouchEnd = () => clearLongPressTimer();

  return (
    <div className={`${styles.msg} ${isMine ? styles.msgOut : styles.msgIn}`}>
      {showHead && (
        /* Header com avatar + nome do sender — só em grupos pra
         * msgs de outros (mesmo padrão do SuperchatPanel). DMs
         * dispensam porque já são 1:1 e o alignment esquerda/direita
         * marca a autoria. */
        <div className={styles.msgHead}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={senderAvatar(m)}
            alt=""
            className={styles.msgAvatar}
          />
          <span className={styles.msgSender}>{senderLabel(m)}</span>
        </div>
      )}
      <div className={styles.bubbleRow}>
        <div
          className={styles.bubble}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          {/* Anexos (imagens) — render dedicado, separado do
           *  URL-detected do MessageBody. Vem ANTES do body pra
           *  espelhar o padrão Instagram/WhatsApp: imagem grande
           *  em cima, legenda embaixo. Quando body é vazio (envio
           *  só de imagem), o MessageBody colapsa graciosamente. */}
          {m.attachments && m.attachments.length > 0 && (
            <MessageAttachments
              items={m.attachments}
              longPressFiredRef={longPressFiredRef}
            />
          )}
          {m.body && <MessageBody body={m.body} maxPreviewWidth={300} />}
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
          {/* Botão Apagar — só aparece quando o parent passou
           *  canDelete=true (própria msg ou owner do grupo). Confirmação
           *  fica delegada pro parent (que mostra o dialog antes de
           *  realmente chamar deleteMessage). */}
          {canDelete && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => onDelete(m.id)}
              aria-label="Apagar mensagem"
              title="Apagar"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2.5 4h11" />
                <path d="M6 4V2.5h4V4" />
                <path d="M3.5 4l.8 9a1 1 0 0 0 1 .9h5.4a1 1 0 0 0 1-.9l.8-9" />
                <path d="M6.5 7v4M9.5 7v4" />
              </svg>
            </button>
          )}
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
    /* senderName/avatar mudam quando o backend re-hidrata (rare —
     * mudança de display name do user). Incluir no comparator
     * garante que o header re-renderiza nesses casos. */
    prev.message.senderName === next.message.senderName &&
    prev.message.senderAvatarUrl === next.message.senderAvatarUrl &&
    prev.message.senderEmail === next.message.senderEmail &&
    /* Attachments compare por count + primeira URL — suficiente
     * porque, na prática, uma mensagem não tem suas imagens
     * trocadas sem o id também mudar. Evita re-render caro
     * comparando array inteiro. */
    (prev.message.attachments?.length ?? 0) ===
      (next.message.attachments?.length ?? 0) &&
    (prev.message.attachments?.[0]?.url ?? '') ===
      (next.message.attachments?.[0]?.url ?? '') &&
    prev.isMine === next.isMine &&
    prev.pickerOpen === next.pickerOpen &&
    prev.showHead === next.showHead &&
    prev.reactionsKey === next.reactionsKey &&
    prev.otherName === next.otherName &&
    prev.canDelete === next.canDelete &&
    prev.onReply === next.onReply &&
    prev.onTogglePicker === next.onTogglePicker &&
    prev.onToggleReaction === next.onToggleReaction &&
    prev.onDelete === next.onDelete &&
    prev.onLongPress === next.onLongPress
  );
});

export default MessageBubble;

/* ──────────────────────────────────────────────────────────────
 * MessageAttachments — grid de imagens anexadas a uma mensagem.
 *
 *   - 1 imagem  → exibe full-width do bubble (max 240×320), com
 *                 aspect-ratio preservado via width/height vindas
 *                 do server.
 *   - 2-4       → grid 2-col, aspect-ratio 1 (quadrado).
 *   - 5-6       → grid 3-col, mesmo aspect-ratio 1.
 *
 * Click abre lightbox simples (overlay full-viewport com a imagem
 * em tamanho natural). Esc + click no backdrop fecham.
 *
 * `loading="lazy"` em todas porque mensagens antigas com várias
 * imagens podem aparecer fora do viewport — não há razão pra
 * baixar tudo no scroll inicial.
 * ────────────────────────────────────────────────────────────── */
function MessageAttachments({
  items,
  longPressFiredRef,
}: {
  items: ApiMessageAttachment[];
  /** Ref controlada pelo MessageBubble pai — sinaliza que o long-press
   *  acabou de disparar e o click subsequente NÃO deve abrir o lightbox.
   *  Sem isso, segurar o dedo numa imagem 500ms abre o action sheet E
   *  o lightbox por trás dele. */
  longPressFiredRef?: MutableRefObject<boolean>;
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const cols = items.length === 1 ? 1 : items.length <= 4 ? 2 : 3;

  return (
    <>
      <div
        className={styles.attachGrid}
        data-cols={cols}
        data-single={items.length === 1 ? 'true' : 'false'}
      >
        {items.map((a, idx) => (
          <button
            key={a.url}
            type="button"
            className={styles.attachItem}
            onClick={() => {
              /* Long-press recém-disparado consome o click — evita
               * lightbox abrindo atrás do action sheet do mobile. */
              if (longPressFiredRef?.current) {
                longPressFiredRef.current = false;
                return;
              }
              setLightboxIdx(idx);
            }}
            aria-label="Ver imagem em tamanho maior"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.url}
              alt=""
              loading="lazy"
              /* width/height help the browser reserve space and
               * avoid layout shift — fallback omitted when server
               * couldn't sniff dimensions. */
              width={a.width ?? undefined}
              height={a.height ?? undefined}
              className={styles.attachImage}
            />
          </button>
        ))}
      </div>
      {lightboxIdx !== null && items[lightboxIdx] && (
        <AttachmentLightbox
          attachment={items[lightboxIdx]}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  );
}

function AttachmentLightbox({
  attachment,
  onClose,
}: {
  attachment: ApiMessageAttachment;
  onClose: () => void;
}) {
  /* Esc fecha — listener global enquanto o lightbox está montado.
   * useEffect proper agora pra cleanup correto (antes era inline
   * e dependia do onKeyDown do backdrop que precisava de focus). */
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* SSR-safe portal: só monta quando document existe. Sem isso o
   * Next.js quebra no server-side render (createPortal precisa de
   * document.body). */
  if (typeof document === 'undefined') return null;

  /* React Portal pro document.body — escapa do stacking context
   * do .panel (que tem backdrop-filter, criando contexto que
   * aprisionava qualquer position:fixed dentro do panel à
   * bounding box dele). Agora o lightbox cobre a viewport TODA. */
  return createPortal(
    <div
      className={styles.lightboxBackdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Imagem em tamanho maior"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={attachment.url}
        alt=""
        className={styles.lightboxImage}
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

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
