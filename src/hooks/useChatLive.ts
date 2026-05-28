'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import { track } from '@/lib/analytics';
import { awardPoints } from '@/lib/rewards';
import type {
  ApiConversationSummary,
  ApiMessage,
  ApiMessageReaction,
} from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSocket } from './useSocket';
import { invalidateConversationMembers } from './useConversationMembers';

/** Count @[Name](uuid) tokens in a message body. Same regex shape
 *  the server uses to parse mentions — keeps the analytics
 *  mention_count consistent with what actually triggers
 *  comment_mention / chat_mention notifications. */
const MENTION_COUNT_RE = /@\[[^\]]+\]\([0-9a-f-]{36}\)/g;
function countMentions(body: string): number {
  return (body.match(MENTION_COUNT_RE) ?? []).length;
}

interface UseChatLiveResult {
  conversations: ApiConversationSummary[];
  loadingList: boolean;
  /** id of the conversation currently open in the chat panel */
  activeId: string | null;
  open: (conversationId: string) => void;
  close: () => void;
  /** messages of the active conversation, oldest → newest */
  messages: ApiMessage[];
  loadingMessages: boolean;
  /* `attachments` opcional — quando vier, o body pode ser vazio
   * ("envia só a imagem"). O sendMessage do server cobre a regra
   * "body OR attachments". */
  send: (
    body: string,
    attachments?: import('@/lib/api/types').ApiMessageAttachment[] | null,
  ) => Promise<void>;
  /**
   * Toggle a reaction emoji on a message. Sends `chat:react` over the
   * socket and waits for the broadcast `chat:reaction` event to update
   * local state. Toggle semantics — calling with the same emoji twice
   * removes the user's reaction.
   */
  react: (messageId: string, emoji: string) => void;
  /** open or create a DM with another user */
  openDmWith: (otherUserId: string) => Promise<void>;
  /**
   * Create a new group conversation and open it. Calls
   * POST /api/conversations with the group payload; refreshes the
   * list and routes the user into the new conversation on success.
   */
  createGroup: (args: {
    name: string;
    memberIds: string[];
    imageUrl?: string | null;
  }) => Promise<void>;
  /** Force a refetch of the conversations list. Used by mutations
   *  done via REST (e.g. group image upload, add member) that don't
   *  go through the socket and therefore can't ride the existing
   *  chat:thread:update broadcast. */
  refreshConversations: () => Promise<void>;
  /**
   * Mark every message in this conversation as read for the current user.
   * Optimistically zeroes unreadCount locally and POSTs to the server.
   * Used by SuperchatPanel (which doesn't go through `open`) plus any
   * other surface that wants to reset the badge without rendering the
   * full LiveChatPanel.
   */
  markRead: (conversationId: string) => Promise<void>;
  /**
   * Soft-delete uma mensagem. Sender (DM/group) ou owner (group) podem
   * apagar — server faz a checagem; client só dispara. Caminho preferido
   * é socket (chat:delete) pra broadcast cross-client; cai pra REST
   * (DELETE /api/messages/:id) quando socket offline.
   *
   * Optimistic: marca local com kind='deleted' antes do round-trip;
   * em erro, rollback pro estado anterior.
   */
  deleteMessage: (messageId: string) => Promise<void>;
}

/**
 * Top-level chat state. List of conversations + currently-open thread,
 * realtime message delivery via Socket.IO.
 *
 * Parent components (page.tsx) own the active id only via this hook —
 * ChatStack reads `conversations`, ChatPanel reads `messages` + `send`.
 */
export function useChatLive(): UseChatLiveResult {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [conversations, setConversations] = useState<ApiConversationSummary[]>([]);
  // Mirror of `conversations` accessible from stale closures (the
  // socket `chat:send` ack runs outside the React render cycle).
  const conversationsRef = useRef<ApiConversationSummary[]>([]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  const [loadingList, setLoadingList] = useState(true);

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // ── Initial conversation list ──────────────────────────────────────────
  const loadList = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ conversations: ApiConversationSummary[] }>(
        '/api/conversations',
      );
      setConversations(res.conversations);
    } catch (err) {
      console.error('chat list fetch failed:', err);
    } finally {
      setLoadingList(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setLoadingList(false);
      return;
    }
    loadList();
  }, [user, loadList]);

  // ── Open a conversation: load history + join the socket room ───────────
  const open = useCallback(
    (conversationId: string) => {
      setActiveId(conversationId);
      setMessages([]);
      setLoadingMessages(true);

      api
        .get<{ messages: ApiMessage[]; hasMore: boolean }>(
          `/api/conversations/${conversationId}/messages`,
        )
        .then((res) => {
          // API returns newest-first; flip to oldest-first for display.
          const ordered = [...res.messages].reverse();
          setMessages(ordered);
          // Optimistically zero this thread's unreadCount in the list while
          // the server-side mark-read is in flight.
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId ? { ...c, unreadCount: 0 } : c,
            ),
          );
          /* P1.5+P1.6: usa o socket pra mark-read quando disponível
           * (broadcast cross-session via chat:read) + passa o
           * messageId direto evitando ORDER BY server-side. POST
           * REST continua como fallback quando socket offline. */
          const lastMessageId =
            ordered.length > 0 ? ordered[ordered.length - 1].id : undefined;
          if (socket && socket.connected) {
            socket.emit('chat:read', {
              conversationId,
              messageId: lastMessageId,
            });
          } else {
            api
              .post(`/api/conversations/${conversationId}/read`, {
                messageId: lastMessageId,
              })
              .catch((err) => console.error('mark read failed:', err));
          }
        })
        .catch((err) => console.error('messages fetch failed:', err))
        .finally(() => setLoadingMessages(false));

      socket?.emit('chat:join', { conversationId });
    },
    [socket],
  );

  const close = useCallback(() => {
    if (activeId && socket) socket.emit('chat:leave', { conversationId: activeId });
    setActiveId(null);
    setMessages([]);
  }, [activeId, socket]);

  // ── Realtime: auto re-join da conv ativa em reconexão ─────────────────
  //
  // P1.8: o socket faz auto-reconnect (singleton em lib/socket/client.ts),
  // mas as rooms server-side se perdem em qualquer disconnect/reconnect.
  // Sem isto, depois de um background-tab no iOS (que mata o WebSocket),
  // o user volta com a conv aberta MAS sem receber mais mensagens —
  // até reabrir manualmente. Fix: em `connect`, re-emitimos chat:join
  // pra activeIdRef.current quando há uma conv aberta.
  //
  // Usamos o ref (não state) pra evitar recriar o handler em cada
  // mudança de activeId — o handler escuta sempre, e olha o ref
  // atual no momento que a reconexão dispara.
  useEffect(() => {
    if (!socket) return;
    const onConnect = () => {
      const convId = activeIdRef.current;
      if (convId) socket.emit('chat:join', { conversationId: convId });
    };
    socket.on('connect', onConnect);
    return () => {
      socket.off('connect', onConnect);
    };
  }, [socket]);

  // ── Send a message via socket (server persists + broadcasts) ───────────
  const send = useCallback(
    async (
      body: string,
      attachments?:
        | import('@/lib/api/types').ApiMessageAttachment[]
        | null,
    ) => {
      const text = body.trim();
      const hasAttachments = !!attachments && attachments.length > 0;
      /* Aceita envio só de imagem (body vazio + attachments). Bloqueia
       * envio totalmente vazio. */
      if (!text && !hasAttachments) return;
      if (!activeId) return;

      // Optimistic — also gets replaced when the broadcast arrives.
      const tempId = `tmp-${Date.now()}`;
      const optimistic: ApiMessage = {
        id: tempId,
        conversationId: activeId,
        senderId: user?.id ?? '',
        body: text,
        createdAt: new Date().toISOString(),
        attachments: hasAttachments ? attachments! : undefined,
      };
      setMessages((prev) => [...prev, optimistic]);

      if (!socket) {
        // Fallback: REST POST
        try {
          const res = await api.post<{ message: ApiMessage }>(
            `/api/conversations/${activeId}/messages`,
            {
              body: text,
              ...(hasAttachments ? { attachments } : {}),
            },
          );
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? res.message : m)),
          );
        } catch (err) {
          console.error('send (REST) failed:', err);
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
        }
        return;
      }

      socket.emit(
        'chat:send',
        {
          conversationId: activeId,
          body: text,
          ...(hasAttachments ? { attachments } : {}),
        },
        (ack: { ok: boolean; messageId?: string; error?: string } | undefined) => {
          if (!ack?.ok) {
            console.error('chat:send rejected:', ack?.error);
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            return;
          }
          /* P0.5 da auditoria: promove o tmp-id pro id real assim
           * que o ack chega. Isso garante que o handler de
           * `chat:message` (que dedupa por id) consiga deduplicar
           * a echo de broadcast em vez de comparar por `body` (que
           * quebra com mensagens duplicadas iguais — "oi", "oi").
           *
           * Mantém o resto dos campos do optimistic local enquanto
           * o broadcast não chega (createdAt, body, etc); na chegada
           * do broadcast o handler `chat:message` faz no-op porque
           * o id já casa. */
          if (ack.messageId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId ? { ...m, id: ack.messageId! } : m,
              ),
            );
          }
          // Resolve conversation type from the active conversation
          // in the local cache. The hook owns `conversations` (see
          // the list state above), so it's already in memory.
          const conv = conversationsRef.current.find((c) => c.id === activeId);
          const mentionCount = countMentions(text);
          track('chat_message_sent', {
            conversation_id: activeId,
            conversation_type: conv?.type ?? 'dm',
            body_length: text.length,
            mention_count: mentionCount,
          });
          if (mentionCount > 0) {
            track('chat_mention_used', {
              conversation_id: activeId,
              mention_count: mentionCount,
            });
          }
        },
      );
    },
    [activeId, socket, user],
  );

  // ── Toggle a reaction on a message via socket ────────────────────────
  const react = useCallback(
    (messageId: string, emoji: string) => {
      if (!socket) return;
      socket.emit(
        'chat:react',
        { messageId, emoji },
        (ack: { ok: boolean; error?: string } | undefined) => {
          if (!ack?.ok) {
            console.warn('chat:react rejected:', ack?.error);
            return;
          }
          // We don't yet know if the reaction was added or removed
          // (the server doesn't pipe action back through ack) — the
          // 'chat:reaction' broadcast we listen to elsewhere
          // resolves it, but for the analytics event we treat the
          // toggle as "added" optimistically. PostHog cohorts then
          // see one event per toggle.
          track('chat_message_reacted', {
            message_id: messageId,
            emoji,
            action: 'added',
          });
        },
      );
      // No optimistic local update — the server broadcasts the new
      // aggregated reactions to everyone in the conversation room
      // (including us) via `chat:reaction`, which then patches state.
    },
    [socket],
  );

  // ── Realtime: reactions update for the active thread ──────────────────
  useEffect(() => {
    if (!socket) return;
    const onReaction = (payload: {
      conversationId: string;
      messageId: string;
      reactions: ApiMessageReaction[];
    }) => {
      // Only update if the change is for the thread we're viewing.
      // Background reactions on other conversations don't affect the
      // message list rendered here.
      if (payload.conversationId !== activeIdRef.current) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? { ...m, reactions: payload.reactions }
            : m,
        ),
      );
    };
    socket.on('chat:reaction', onReaction);
    return () => {
      socket.off('chat:reaction', onReaction);
    };
  }, [socket]);

  // ── Realtime: chat:message:deleted broadcast ──────────────────────────
  //
  // Server broadcastia pro room (conv:{id}) sempre que um delete é
  // bem-sucedido. Cobre 3 cenários:
  //   1. User apagou em outra session (web + mobile abertos): a session
  //      ativa atualiza o bubble sem precisar refetch
  //   2. Outra parte da DM apagou — viewer vê o bubble virar pílula
  //   3. Owner do grupo apagou msg de outro membro — todos viewers veem
  //
  // Idempotente: se a msg já está kind='deleted' (porque o sender já
  // optimistic-aplicou), o map retorna o mesmo objeto e React skipa.
  useEffect(() => {
    if (!socket) return;
    const onDeleted = (payload: {
      conversationId: string;
      messageId: string;
    }) => {
      if (payload.conversationId !== activeIdRef.current) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? { ...m, kind: 'deleted' as const, body: '', attachments: null }
            : m,
        ),
      );
    };
    socket.on('chat:message:deleted', onDeleted);
    return () => {
      socket.off('chat:message:deleted', onDeleted);
    };
  }, [socket]);

  // ── Realtime: incoming chat messages (active thread) ───────────────────
  //
  // P0.1 da auditoria: NÃO chamar mais `loadList()` aqui. O handler
  // antigo refazia GET /api/conversations a cada mensagem recebida —
  // num grupo de 28 membros isso vira 28 round-trips por mensagem,
  // que é o caminho mais rápido pra rebentar o connection pool do
  // Postgres em prod quando o Superchat viralizar.
  //
  // Em vez disso, patchamos a row da conversa local: atualiza
  // lastMessage + incrementa unreadCount quando NÃO é a conversa
  // ativa nem o próprio user. A `chat:thread:update` continua sendo
  // o canal pra mudanças de fora do hot-path (add member, rename
  // group, image upload, etc).
  useEffect(() => {
    if (!socket) return;
    const onMessage = (msg: ApiMessage) => {
      const isActive = msg.conversationId === activeIdRef.current;
      const isOwn = msg.senderId === user?.id;

      if (isActive) {
        setMessages((prev) => {
          // Dedupe por id real (P0.5): tmp-id já foi promovido pro
          // messageId real pelo ack. Se o broadcast chegar primeiro,
          // o filter abaixo remove qualquer tmp- restante; se chegar
          // depois, o id já existe e damos return prev.
          if (prev.some((m) => m.id === msg.id)) return prev;
          const filtered = prev.filter((m) => !m.id.startsWith('tmp-'));
          return [...filtered, msg];
        });
        // User is viewing this thread — keep the read marker fresh.
        // P1.6: passa o messageId direto, evitando ORDER BY no server.
        api
          .post(`/api/conversations/${msg.conversationId}/read`, {
            messageId: msg.id,
          })
          .catch((err) => console.error('mark read (active) failed:', err));
      }
      /* O toast dinâmico vive no handler de `chat:thread:update`
       * (abaixo) — esse evento chega no userRoom de TODOS os
       * recipients, incluindo quem NÃO está joined no room
       * conv:{id}. Antes tentei despachar daqui (chat:message),
       * mas users sem a conv aberta nunca recebem chat:message
       * — só thread:update. Single source of truth = thread:update. */

      // Patch local da row na lista de conversas. Sem hit ao servidor.
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.conversationId);
        if (idx === -1) {
          /* Conversa não está em memória — pode ser DM nova criada
           * pela outra parte. Único caso em que ainda precisamos do
           * round-trip pra trazer a conversation summary completa
           * (otherUser hidrado, role, member_count). */
          loadList();
          return prev;
        }
        const next = [...prev];
        const cur = next[idx];
        next[idx] = {
          ...cur,
          lastMessage: {
            id: msg.id,
            body: msg.body,
            senderId: msg.senderId,
            createdAt: msg.createdAt,
          },
          /* Só incrementa unread se NÃO for a conv ativa E não foi o
           * próprio user que mandou. Quem está olhando a conversa
           * leu na hora; o próprio sender não precisa de badge. */
          unreadCount:
            isActive || isOwn ? cur.unreadCount : cur.unreadCount + 1,
        };
        /* Re-sort por last message DESC pra manter a regra de
         * ordering do dock/lista. Move só a row tocada pro topo —
         * mais barato que sort completo. */
        const updated = next[idx];
        next.splice(idx, 1);
        next.unshift(updated);
        return next;
      });
    };
    socket.on('chat:message', onMessage);
    return () => {
      socket.off('chat:message', onMessage);
    };
  }, [socket, loadList, user]);

  // ── Realtime: chat:read cross-session sync (P1.5) ───────────────────────
  //
  // Quando o user lê uma conv numa sessão (web), as outras sessions
  // (mobile, outra aba) recebem este broadcast pelo userRoom e
  // zeram o badge local sem polling. Conversa NÃO precisa estar
  // ativa pra receber — só precisa estar na lista.
  useEffect(() => {
    if (!socket) return;
    const onRead = (payload: { conversationId: string }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === payload.conversationId && c.unreadCount > 0
            ? { ...c, unreadCount: 0 }
            : c,
        ),
      );
    };
    socket.on('chat:read', onRead);
    return () => {
      socket.off('chat:read', onRead);
    };
  }, [socket]);

  // ── Realtime: per-user thread update poke ───────────────────────────────
  //
  // Disparado pelo server pra eventos de FORA do hot-path de envio:
  // add/remove member, rename group, image upload, hide conversation.
  // Esses casos mudam a forma da conversation summary (memberCount,
  // name, imageUrl, etc.) que o patch local do `chat:message` não
  // cobre. Aqui sim refrescamos a lista do servidor.
  //
  // P1.3: skip se o payload é pra conv que o user JÁ está vendo —
  // chat:message já cobriu o patch local (lastMessage + unread). O
  // thread:update disparado pelo mesmo send vira no-op pra evitar
  // refetch redundante. Outros disparos de thread:update (rename,
  // addMember vindos de outras sessões) ainda funcionam porque eles
  // virão por canais que NÃO emitem chat:message.
  useEffect(() => {
    if (!socket) return;
    const onThreadUpdate = (payload?: {
      conversationId?: string;
      senderId?: string;
      senderName?: string | null;
      senderAvatarUrl?: string | null;
      snippet?: string;
    }) => {
      /* P1.2: invalida cache de members da conversa tocada — pode
       * ter sido addMember/kick/rename/image upload. Forçar refetch
       * mantém GroupMembersPanel/mention autocomplete em sync.
       * Quando payload sem conversationId vier (broadcast legado),
       * invalidamos tudo defensivamente. */
      invalidateConversationMembers(payload?.conversationId);

      /* Toast dinâmico no MockToastRotator: quando o thread:update
       * traz `snippet` (msg nova) E a conv NÃO é a ativa, dispara
       * o evento que o rotator escuta. Sem isso, recipients que
       * NÃO estão joined em room(convId) (caso comum: conv não
       * aberta) nunca recebiam o toast — porque `chat:message` só
       * vai pro room, não pro userRoom.
       *
       * O sender é filtrado: o servidor só emite chat:thread:update
       * pra `recipientIds` que JÁ exclui o sender, mas a guarda
       * dupla aqui (senderId vs user.id) protege caso a broadcast
       * mude futuramente. */
      if (
        payload?.snippet &&
        payload.conversationId &&
        payload.conversationId !== activeIdRef.current &&
        payload.senderId !== user?.id
      ) {
        window.dispatchEvent(
          new CustomEvent('app:chat-message-toast', {
            detail: {
              senderName:
                payload.senderName?.trim() ||
                'Alguém',
              senderAvatarUrl: payload.senderAvatarUrl ?? null,
              snippet: payload.snippet,
              conversationId: payload.conversationId,
            },
          }),
        );
      }

      if (
        payload?.conversationId &&
        payload.conversationId === activeIdRef.current
      ) {
        return;
      }
      loadList();
    };
    socket.on('chat:thread:update', onThreadUpdate);
    return () => {
      socket.off('chat:thread:update', onThreadUpdate);
    };
  }, [socket, loadList, user]);

  // ── Open or create a DM with someone (e.g. clicking a user on the map) ─
  const openDmWith = useCallback(
    async (otherUserId: string) => {
      try {
        const res = await api.post<{ id: string; created: boolean }>(
          '/api/conversations',
          { otherUserId },
        );
        if (res.created) {
          // Engagement reward (+3 FP) — server already inserted the
          // `chat_started` activity row inside POST /api/conversations
          // (see server/chat/dm.ts). This is the client-side toast +
          // analytics for the first-time DM creation. `created: false`
          // means the conversation already existed, so no award.
          void awardPoints('chat_started', {
            analyticsContext: { conversation_id: res.id },
          });
        }
        /* Bug 1 fix: ALWAYS refresh a lista antes do open() —
         * `created: false` cobre 2 casos: (a) conv existia ativa
         * (loadList já tem ela; refresh é no-op cheap) E (b) conv
         * existia mas estava hidden pra esse user (servidor acabou
         * de limpar hidden_at). No caso (b), o loadList é
         * obrigatório pra que activeConversation no /app/chat
         * encontre a row no array — sem isso, o LiveChatPanel
         * abria vazio. */
        await loadList();
        open(res.id);
      } catch (err) {
        console.error('openDmWith failed:', err);
      }
    },
    [loadList, open],
  );

  // ── Create a new group + open it ─────────────────────────────────────
  const createGroup = useCallback(
    async (args: {
      name: string;
      memberIds: string[];
      imageUrl?: string | null;
    }) => {
      try {
        const res = await api.post<{ id: string; created: boolean }>(
          '/api/conversations',
          {
            type: 'group',
            name: args.name,
            memberIds: args.memberIds,
            imageUrl: args.imageUrl ?? null,
          },
        );
        await loadList();
        open(res.id);
      } catch (err) {
        console.error('createGroup failed:', err);
      }
    },
    [loadList, open],
  );

  const markRead = useCallback(async (conversationId: string) => {
    // No-op when nothing actually needs marking — both the local state
    // setter and the POST below are skipped if unreadCount is already 0.
    //
    // Why this matters: prev.map(...) ALWAYS returns a fresh array, even
    // when no element actually changed. React then re-renders the page,
    // and any caller that passes a fresh closure as `onMarkRead` ends up
    // recreating the callback on every render — which retriggers the
    // effect that called markRead in the first place. Infinite loop.
    let shouldFetch = false;
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conversationId);
      if (idx === -1) return prev;
      if (prev[idx].unreadCount === 0) return prev;
      shouldFetch = true;
      const next = [...prev];
      next[idx] = { ...next[idx], unreadCount: 0 };
      return next;
    });
    if (!shouldFetch) return;
    try {
      await api.post(`/api/conversations/${conversationId}/read`);
    } catch (err) {
      console.error('markRead failed:', err);
      // Rollback on failure — refetch the list to recover the true count.
      loadList();
    }
  }, [loadList]);

  /* ── Delete uma mensagem (soft-delete) ──────────────────────────
   *
   * Optimistic: marca a row com kind='deleted', body='', attachments=null
   * antes do request. Mantém uma copia da row original em closure pra
   * rollback caso o server rejeite (forbidden / not_deletable / 404).
   *
   * Caminho preferido = socket (chat:delete) — server broadcastia
   * `chat:message:deleted` pro room, cobrindo TODOS os viewers
   * (incluindo o próprio sender em outras sessions). Sem socket,
   * cai pra REST DELETE — só esse cliente atualiza, outros vão
   * descobrir no próximo refetch (aceitável pra fallback raro).
   *
   * Sucesso: o broadcast chat:message:deleted re-trigger o mesmo
   * patch local, mas como já está em kind='deleted' o handler do
   * broadcast vira no-op (idempotente). */
  const deleteMessage = useCallback(
    async (messageId: string) => {
      // Snapshot da row pra rollback
      let snapshot: ApiMessage | null = null;
      setMessages((prev) => {
        const found = prev.find((m) => m.id === messageId);
        if (found) snapshot = found;
        return prev.map((m) =>
          m.id === messageId
            ? { ...m, kind: 'deleted' as const, body: '', attachments: null }
            : m,
        );
      });
      if (!snapshot) return; // mensagem não está em memória; no-op

      const restoreSnapshot = () => {
        const snap = snapshot;
        if (!snap) return;
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? snap : m)),
        );
      };

      if (socket && socket.connected) {
        socket.emit(
          'chat:delete',
          { messageId },
          (ack: { ok: boolean; error?: string } | undefined) => {
            if (!ack?.ok) {
              console.error('chat:delete rejected:', ack?.error);
              restoreSnapshot();
            }
            // Sucesso: broadcast chat:message:deleted chega no handler
            // e re-aplica o patch (no-op porque já está deleted).
          },
        );
        return;
      }

      // Fallback REST quando socket indisponível
      try {
        await api.delete(`/api/messages/${messageId}`);
      } catch (err) {
        console.error('deleteMessage (REST) failed:', err);
        restoreSnapshot();
      }
    },
    [socket],
  );

  return {
    conversations,
    loadingList,
    activeId,
    open,
    close,
    messages,
    loadingMessages,
    send,
    react,
    openDmWith,
    createGroup,
    refreshConversations: loadList,
    markRead,
    deleteMessage,
  };
}
