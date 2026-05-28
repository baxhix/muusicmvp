'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import type {
  ApiConversationSummary,
  ApiMessage,
  ApiMessageAttachment,
} from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { buildReplyBody } from './MessageBody';
import MessageBubble, {
  SystemMessagePill,
  hashReactions,
} from './MessageBubble';
import { showAppToast } from './AppToast';
import { confirmDialog } from './ConfirmDialog';
import VerifiedBadge from './VerifiedBadge';
/* P2.7 — code-split: ReportModal e MentionAutocomplete são usados
 * só em paths secundários (kebab "Denunciar" + composer com @).
 * Carregar lazy reduz o JS inicial do painel (~12KB gzip cada),
 * que importa em mobile com network lenta. ssr:false porque
 * ambos são interativos puros e dependem de window. */
const ReportModal = dynamic(() => import('./ReportModal'), { ssr: false });
const MentionAutocomplete = dynamic(() => import('./MentionAutocomplete'), {
  ssr: false,
});
import {
  useConversationMembers,
  type MentionableMember,
} from '@/hooks/useConversationMembers';
import { useAuth as useAuthCtx } from '@/lib/auth/AuthContext';
import styles from './LiveChatPanel.module.css';

/** Auto-resize do textarea: cresce com o conteúdo até MAX_PX, depois
 *  aparece scroll. Reseta pra altura natural antes de medir
 *  scrollHeight pra que ENCOLHA quando o usuário apaga linhas. */
const MAX_CHAT_TEXTAREA_PX = 120;
function autoResizeChat(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, MAX_CHAT_TEXTAREA_PX)}px`;
}

/** Block-user remains stubbed — the /api/block endpoint doesn't exist
 *  yet. Reporting (above) is wired to real /api/reports. */
async function blockUser(userId: string, name: string | null): Promise<void> {
  const ok = await confirmDialog({
    title: `Bloquear ${name ?? 'este usuário'}?`,
    body: 'Vocês não vão mais conseguir trocar mensagens.',
    confirmLabel: 'Bloquear',
    tone: 'danger',
  });
  if (!ok) return;
  console.warn('[chat] TODO: POST /api/block', { targetUserId: userId });
  showAppToast({
    message: `${name ?? 'Usuário'} bloqueado.`,
    tone: 'success',
  });
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
  onSend: (
    body: string,
    attachments?: ApiMessageAttachment[] | null,
  ) => Promise<void>;
  /** Toggle a reaction emoji on a message. Server-persisted via socket. */
  onReact: (messageId: string, emoji: string) => void;
  /** Apaga uma mensagem (soft-delete server-side). Parent (chat/page.tsx)
   *  delega pro hook `useChatLive.deleteMessage`. UI mostra confirmação
   *  antes de chamar — não há undo. */
  onDeleteMessage: (messageId: string) => Promise<void>;
  /** Fired from the kebab menu when the user clicks "Ver membros"
   *  in a group conversation. Parent should open GroupMembersPanel. */
  onOpenMembers?: () => void;
  /** Fired from the kebab menu when the user clicks "Sair do
   *  grupo". Parent should open a confirm + call the DELETE
   *  /members/:userId endpoint. */
  onLeaveGroup?: () => void;
  /** "Apagar conversa pra mim" — disparado pelo kebab, tanto em
   *  DMs quanto em grupos. Parent chama POST /api/.../hide e
   *  mostra toast + fecha o painel. */
  onHideConversation?: () => void;
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
  onDeleteMessage,
  onOpenMembers,
  onLeaveGroup,
  onHideConversation,
}: Props) {
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  /* Anexos pendentes — imagens já uploadadas mas ainda não enviadas
   * com a próxima mensagem. Cada item = { url, mimeType, size,
   * width, height } vindo do POST /api/conversations/:id/upload.
   * Limite client-side de 6 espelha o server (MAX_ATTACHMENTS). */
  const [pendingAttachments, setPendingAttachments] = useState<
    ApiMessageAttachment[]
  >([]);
  /* Estado de upload em curso. Bloqueia o submit + mostra um
   * spinner no botão de paperclip enquanto sobe. */
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /* Drag-and-drop: overlay visual + contador (dragenter/leave podem
   * disparar várias vezes em nested children, então contamos pra
   * que o overlay só some quando o counter zera de verdade). */
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  // @mention autocomplete state. `mentionStart` is the cursor
  // position where the active "@" sits; null means no autocomplete
  // is open right now. `mentionQuery` is the text typed AFTER the
  // "@" — used to filter the suggestions. `pickedMentions` accumu-
  // lates user picks so we can serialize them into the canonical
  // @[name](uuid) format at send time.
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [pickedMentions, setPickedMentions] = useState<MentionableMember[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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

  // ── Visual-viewport tracking (mobile keyboard fix) ──
  //
  // On iOS Safari, `position: fixed` elements use the LAYOUT
  // viewport, not the visual viewport. When the keyboard opens,
  // the layout viewport stays at full screen height, so our
  // `height: 100dvh` panel keeps its bottom edge BELOW the
  // keyboard — the composer is invisible behind it.
  //
  // The fix: subscribe to `window.visualViewport` and write the
  // current visible height into a CSS variable on the panel.
  // The CSS uses `var(--chat-visual-h, 100dvh)` so older browsers
  // without VisualViewport (or desktop where it always equals the
  // window) fall back to the dynamic viewport unit as before.
  //
  // Tracking the top offset too (visualViewport.offsetTop) keeps
  // the panel anchored to the visible region when the URL bar
  // collapses — otherwise the panel would drift 50-ish pixels up
  // and clip the header off-screen.
  const [vv, setVv] = useState<{ h: number | null; top: number }>({
    h: null,
    top: 0,
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const update = () => {
      const v = window.visualViewport!;
      setVv({ h: v.height, top: v.offsetTop });
    };
    update();
    window.visualViewport.addEventListener('resize', update);
    window.visualViewport.addEventListener('scroll', update);
    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);
  // Inline style only carries the height/top when we have a real
  // visual-viewport reading AND the panel is open — desktop and
  // the closed state keep the panel as the CSS spec'd it.
  const panelInlineStyle =
    vv.h !== null && isOpen
      ? ({
          ['--chat-visual-h' as string]: `${vv.h}px`,
          ['--chat-visual-top' as string]: `${vv.top}px`,
        } as React.CSSProperties)
      : undefined;

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

  /* P1.1: callbacks estáveis via useCallback pra que o memo do
   * MessageBubble não invalide por reference change a cada render
   * do parent. */
  const toggleReaction = useCallback(
    (msgId: string, emoji: string) => {
      onReact(msgId, emoji);
      setPickerOpenId(null);
    },
    [onReact],
  );

  const handleTogglePicker = useCallback((msgId: string) => {
    setPickerOpenId((cur) => (cur === msgId ? null : msgId));
  }, []);

  const handleReply = useCallback(
    (replyTo: { senderName: string; body: string }) => {
      setReplyingTo(replyTo);
    },
    [],
  );

  /* Confirmação antes de chamar onDeleteMessage. Não há undo —
   * o soft-delete server-side zera body + attachments e o arquivo
   * de imagem é unlinkado do disco. */
  const handleDelete = useCallback(
    async (messageId: string) => {
      const ok = await confirmDialog({
        title: 'Apagar mensagem?',
        body: 'Essa ação não pode ser desfeita.',
        confirmLabel: 'Apagar',
        tone: 'danger',
      });
      if (!ok) return;
      try {
        await onDeleteMessage(messageId);
      } catch (err) {
        console.error('delete message failed:', err);
        showAppToast({
          message: 'Não foi possível apagar a mensagem.',
          tone: 'error',
        });
      }
    },
    [onDeleteMessage],
  );

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
    const hasAttachments = pendingAttachments.length > 0;
    /* Aceita envio só de imagem (body vazio + attachments). Bloqueia
     * envio totalmente vazio e enquanto há upload em curso. */
    if ((!text && !hasAttachments) || uploadingCount > 0) return;
    const mentioned = serializeMentions(text);
    // If the user is replying to a message, wrap the body in the
    // shared reply-prefix format BEFORE sending so both sides see
    // the same quoted preview when MessageBody renders it.
    const body = replyingTo
      ? buildReplyBody(replyingTo.senderName, replyingTo.body, mentioned)
      : mentioned;
    const attachments = hasAttachments ? pendingAttachments : null;
    setDraft('');
    setPendingAttachments([]);
    setReplyingTo(null);
    setPickedMentions([]);
    setMentionStart(null);
    setMentionQuery('');
    /* Reseta altura do textarea — sem isso, depois de enviar uma
     * mensagem multi-linha o campo fica esticado com o draft vazio. */
    requestAnimationFrame(() => autoResizeChat(inputRef.current));
    await onSend(body, attachments);
  };

  /* ── Upload de imagens ────────────────────────────────────────
   * Disparado pelo input[type=file] hidden. Sobe cada arquivo em
   * paralelo (sequencial seria UX ruim no caso comum de N=1) e
   * acumula no `pendingAttachments`. Erros viram toast individual
   * — falha de 1 arquivo não bloqueia os outros.
   *
   * Validação client-side leve (size + MIME) pra dar feedback
   * antes do round-trip. Servidor faz a validação canônica em
   * `saveChatImage` (cobre o caso de cliente forjar payload). */
  const handleFilesPicked = async (files: FileList | null) => {
    if (!files || files.length === 0 || !conversation) return;
    const remainingSlots = 6 - pendingAttachments.length;
    if (remainingSlots <= 0) {
      showAppToast({
        message: 'Limite de 6 imagens por mensagem.',
        tone: 'error',
      });
      return;
    }
    const list = Array.from(files).slice(0, remainingSlots);
    const ALLOWED = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ]);
    const MAX = 8 * 1024 * 1024;
    for (const file of list) {
      if (!ALLOWED.has(file.type)) {
        showAppToast({
          message: `"${file.name}": tipo não suportado.`,
          tone: 'error',
        });
        continue;
      }
      if (file.size > MAX) {
        showAppToast({
          message: `"${file.name}": maior que 8MB.`,
          tone: 'error',
        });
        continue;
      }
      setUploadingCount((n) => n + 1);
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(
          `/api/conversations/${conversation.id}/upload`,
          { method: 'POST', body: form, credentials: 'include' },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? `http_${res.status}`);
        }
        const data = (await res.json()) as ApiMessageAttachment;
        setPendingAttachments((prev) => [...prev, data]);
      } catch (err) {
        console.error('chat upload failed:', err);
        showAppToast({
          message: `"${file.name}": falha no upload.`,
          tone: 'error',
        });
      } finally {
        setUploadingCount((n) => n - 1);
      }
    }
  };

  const removeAttachment = (url: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.url !== url));
  };

  /* ── Drag-and-drop de arquivos ─────────────────────────────────
   * Aceita arrastar imagem do desktop/explorer direto pro panel.
   * Reaproveita `handleFilesPicked` pra que a validação (MIME +
   * size + slots) seja idêntica ao caminho do paperclip. Overlay
   * só aparece se a conv estiver aberta E o user não saiu do grupo
   * (composer hidden = drop não faz sentido — o check `hasLeftGroup`
   * roda dentro dos handlers em closure pra evitar TDZ porque ele
   * é declarado mais abaixo no componente).
   *
   * dragCounter cuida do flicker de dragenter/dragleave que dispara
   * em CADA child element do panel — incrementa na entrada, decre-
   * menta na saída; overlay só some quando o counter zera. */
  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (!conversation || conversation.myLeftAt) return;
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!conversation || conversation.myLeftAt) return;
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!conversation || conversation.myLeftAt) return;
    /* preventDefault no dragover é OBRIGATÓRIO pra que o drop seja
     * aceito pelo browser — sem ele, dropEffect vira 'none' e o
     * cursor mostra o ícone de bloqueado. */
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!conversation || conversation.myLeftAt) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    void handleFilesPicked(files);
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

  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDraft(value);
    updateMentionState(value, e.target.selectionStart ?? value.length);
    /* Auto-grow: cresce com o conteúdo até 120px, depois scroll
     * interno. Sem isso, o textarea ficaria fixo em 1 linha mesmo
     * com várias quebras (shift+enter). */
    autoResizeChat(e.currentTarget);
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

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Mention autocomplete consumes Enter to pick the highlight.
      // Don't submit while it's open — its global keydown listener
      // already called preventDefault on this Enter.
      if (mentionStart !== null) return;
      e.preventDefault();
      submit();
    }
    /* Shift+Enter cai pro default do textarea: insere \n na posição
     * do caret. Não precisa de handler — só não chamamos
     * preventDefault. */
  };

  const isGroup = conversation?.type === 'group';
  const other = conversation?.otherUser;
  /* Verdadeiro quando o user atual saiu (ou foi kickado) deste
   * grupo. Drives o read-only banner + esconde o composer +
   * influencia a renderização do system_leave message
   * (badge "Você saiu" vs "{X} saiu do grupo"). */
  const hasLeftGroup = isGroup && !!conversation?.myLeftAt;
  // Display identity is shape-dependent:
  //   DM    → conversation.otherUser.{name,avatar,verified}
  //   Group → conversation.{name,imageUrl} (no verified concept)
  const headerName = isGroup
    ? (conversation?.name ?? 'Grupo')
    : (other?.name ?? 'Conversa');
  const seedId = isGroup ? (conversation?.id ?? 'unknown') : (other?.id ?? 'unknown');
  // Superchat (global group) renders with the cowboy-hat icon so
  // the panel header matches the chat list + dock visual. Same
  // detection rationale as in ConversationsSidebar — match by
  // name because the API doesn't currently expose the slug.
  const isSuperchat = isGroup && conversation?.name === 'Superchat';
  const avatar = isSuperchat
    ? '/icon-chapeu-ac.svg'
    : isGroup
      ? (conversation?.imageUrl ?? '/avatar-placeholder.svg')
      : (other?.avatarUrl ?? (other ? '/avatar-placeholder.svg' : null));
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
      style={panelInlineStyle}
      role="dialog"
      aria-label={`Chat com ${headerName}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Drop overlay — só aparece enquanto arrastar arquivo de
       *  fora do browser. pointer-events:none no CSS pra que o evento
       *  de drag continue chegando no panel-pai (o overlay não
       *  intercepta os handlers). */}
      {isDragging && (
        <div className={styles.dropOverlay} aria-hidden="true">
          <div className={styles.dropPrompt}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Solte para anexar</span>
          </div>
        </div>
      )}
      <div className={styles.header}>
        {/* Back arrow — visible on mobile only (CSS-gated via
         *  the panel's media query). Anchors on the LEFT of the
         *  header so the layout reads as a standard mobile chat
         *  screen. Tapping clears chat.activeId via onClose, which
         *  returns the user to the conversations sidebar. */}
        <button
          className={styles.backBtn}
          onClick={onClose}
          aria-label="Voltar para conversas"
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {avatar && (
          <span className={styles.headerAvatarWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatar}
              alt={headerName}
              className={`${styles.headerAvatar} ${isGroup ? styles.headerAvatarGroup : ''}`}
              onError={(e) => {
                // 404? Fall back to the silhouette so the chat
                // header never paints a broken-image icon. Same
                // resilience pattern as the dock + sidebar.
                const img = e.currentTarget;
                const fb = '/avatar-placeholder.svg';
                if (img.src.endsWith(fb)) return;
                img.src = fb;
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
                    {/* "Sair do grupo" só aparece pra membros AINDA
                     * ativos. Quem já saiu cai no banner read-only,
                     * sem precisar do botão. */}
                    {!hasLeftGroup && (
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
                    )}
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
                {/* "Apagar conversa pra mim" disponível em AMBOS os
                 * modos (DM e grupo). Diferente do "Sair do grupo",
                 * essa ação é local — não envia mensagem nem afeta
                 * a outra parte. */}
                {onHideConversation && (
                  <button
                    type="button"
                    role="menuitem"
                    className={`${styles.kebabItem} ${styles.kebabItemDanger}`}
                    onClick={() => {
                      setMenuOpen(false);
                      onHideConversation();
                    }}
                  >
                    Apagar conversa
                  </button>
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

              // Mensagem apagada (kind='deleted') — pílula neutra
              // "Mensagem apagada" sem identificar autor. Cobre antes do
              // branch system_* abaixo porque kind='deleted' É um system
              // kind mas precisa de copy específico (não tem body).
              if (m.kind === 'deleted') {
                nodes.push(
                  <SystemMessagePill
                    key={m.id}
                    who=""
                    verb="Mensagem apagada"
                  />,
                );
                continue;
              }

              // System events: pílula cinza centralizada via memo'd
              // component (SystemMessagePill). Não tem hover-actions
              // nem reactions, então a memoization é trivial por
              // (who, verb).
              if (m.kind && m.kind !== 'user') {
                const isMe = m.senderId === user?.id;
                const who =
                  isMe
                    ? 'Você'
                    : m.senderName ??
                      m.senderEmail?.split('@')[0] ??
                      'Alguém';
                const verb =
                  isMe && m.kind === 'system_leave' ? 'saiu' : m.body;
                nodes.push(
                  <SystemMessagePill key={m.id} who={who} verb={verb} />,
                );
                continue;
              }

              // User-typed message: bubble memoizada por
              // (id, body, createdAt, reactionsKey, pickerOpen, isMine).
              // Callbacks são useCallback estáveis no parent — memo
              // realmente skipa re-renders quando nada relevante muda.
              const isMine = m.senderId === user?.id;
              const pickerOpen = pickerOpenId === m.id;
              /* Em grupos, mostra header (avatar + nome do sender)
               * acima das mensagens de OUTROS users — mesmo padrão
               * do SuperchatPanel. Em DMs, dispensa porque 1:1 já
               * tem alignment esquerda/direita identificando autoria. */
              const showHead = isGroup && !isMine;
              /* canDelete: própria msg sempre, OU owner do grupo
               * pode apagar de qualquer um. Server faz a checagem
               * canônica — flag aqui só drives a visibilidade da UI. */
              const isGroupOwner =
                isGroup && conversation?.createdBy === user?.id;
              const canDelete = isMine || isGroupOwner;
              nodes.push(
                <MessageBubble
                  key={m.id}
                  message={m}
                  isMine={isMine}
                  reactionsKey={hashReactions(m.reactions)}
                  pickerOpen={pickerOpen}
                  showHead={showHead}
                  otherName={other?.name}
                  canDelete={canDelete}
                  pickerRef={pickerRef}
                  onReply={handleReply}
                  onTogglePicker={handleTogglePicker}
                  onToggleReaction={toggleReaction}
                  onDelete={handleDelete}
                />,
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

      {hasLeftGroup ? (
        /* Read-only banner — user saiu do grupo (ou foi kickado).
         * Pode continuar lendo o histórico, mas o composer desaparece
         * pra evitar tentativa de envio que renderia 403 no servidor.
         * Per product feedback: "Você saiu do grupo e não pode mais
         * enviar mensagens". */
        <div className={styles.leftBanner}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1v6M7 11v.01M7 13a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span>Você saiu do grupo e não pode mais enviar mensagens</span>
        </div>
      ) : (
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

        {/* Preview de anexos pendentes — só aparece se há alguma
         *  imagem já uploadada esperando o envio. Cada item tem
         *  thumbnail + X pra remover. */}
        {pendingAttachments.length > 0 && (
          <div className={styles.attachPreviewRow}>
            {pendingAttachments.map((a) => (
              <div key={a.url} className={styles.attachPreviewItem}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt="" className={styles.attachPreviewImg} />
                <button
                  type="button"
                  className={styles.attachPreviewRemove}
                  onClick={() => removeAttachment(a.url)}
                  aria-label="Remover imagem"
                >
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                    <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input file invisível — o paperclip dispara o picker via
         *  click(). multiple=true permite escolher várias de uma vez;
         *  a checagem de slots livres é client-side em handleFilesPicked. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            void handleFilesPicked(e.target.files);
            /* Limpa o input pra que escolher o MESMO arquivo de novo
             * (ex: depois de remover) dispare o onChange de novo. */
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className={styles.attachBtn}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Anexar imagem"
          disabled={uploadingCount > 0 || pendingAttachments.length >= 6}
          title={
            pendingAttachments.length >= 6
              ? 'Limite de 6 imagens'
              : 'Anexar imagem'
          }
        >
          {uploadingCount > 0 ? (
            <svg className={styles.attachSpinner} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            /* Paperclip Lucide-style — viewBox 24×24 com path canônico
             * (mesmo desenho usado em Slack/Linear). Antes era um path
             * customizado que escapava do viewBox 16×16 e ficava
             * deformado em renderização. */
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          )}
        </button>

        <textarea
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
          rows={1}
        />
        <button
          className={styles.sendBtn}
          onClick={submit}
          aria-label="Enviar"
          /* Envia se houver texto OU anexos; bloqueia durante upload
           * pra não enviar mensagem com anexo incompleto. */
          disabled={
            (!draft.trim() && pendingAttachments.length === 0) ||
            uploadingCount > 0
          }
        >
          <svg viewBox="0 0 14 14" fill="none">
            <path d="M1.5 7.5L12.5 2.5 8.5 12.5 7 8 1.5 7.5z" fill="currentColor" />
          </svg>
        </button>
      </div>
      )}

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
