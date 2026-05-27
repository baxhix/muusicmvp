'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type {
  ApiConversationSummary,
  ApiGroupMember,
} from '@/lib/api/types';

/** Lightweight shape consumed by the mention autocomplete — the
 *  minimum needed to render + insert a @mention token. */
export interface MentionableMember {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  email: string;
}

/**
 * Cache module-level dos members por conversation (P1.2 da auditoria).
 *
 * Antes: cada componente que usa `useConversationMembers` fazia seu
 * próprio fetch — LiveChatPanel + GroupMembersPanel + MentionAutocomplete
 * = 3 round-trips por open de grupo. Agora compartilhamos o cache
 * entre eles. Invalidado em:
 *   - `chat:thread:update` (broadcast do socket — add/remove/rename)
 *   - Mutações locais que sabidamente alteram roster (kick, add, leave)
 *
 * Map+inflight-promise garantem que duas instâncias subindo ao mesmo
 * tempo compartilhem a mesma request em-voo (dedupe).
 */
const membersCache = new Map<string, ApiGroupMember[]>();
const inflight = new Map<string, Promise<ApiGroupMember[]>>();
const subscribers = new Set<() => void>();

function notifySubscribers() {
  for (const cb of subscribers) {
    try { cb(); } catch { /* swallow — uma inscrição quebrada não pode derrubar as outras */ }
  }
}

/** Invalida o cache de uma conversa (ou tudo) e notifica todos os
 *  hooks ativos pra re-fetchar quando renderizarem. */
export function invalidateConversationMembers(conversationId?: string): void {
  if (conversationId) {
    membersCache.delete(conversationId);
    inflight.delete(conversationId);
  } else {
    membersCache.clear();
    inflight.clear();
  }
  notifySubscribers();
}

async function fetchMembers(conversationId: string): Promise<ApiGroupMember[]> {
  // Dedupe in-flight: 2 hooks renderizam ao mesmo tempo, só 1 GET sai.
  const existing = inflight.get(conversationId);
  if (existing) return existing;
  const p = api
    .get<{ members: ApiGroupMember[] }>(
      `/api/conversations/${conversationId}/members`,
    )
    .then((res) => {
      membersCache.set(conversationId, res.members);
      notifySubscribers();
      return res.members;
    })
    .finally(() => {
      inflight.delete(conversationId);
    });
  inflight.set(conversationId, p);
  return p;
}

/**
 * Resolve the list of users that can be @-mentioned in this
 * conversation, EXCLUDING the current user.
 *
 *   - DM    → returns just the other participant (no fetch needed,
 *             the data is already on the conversation summary).
 *   - Group → GET /api/conversations/:id/members the first time the
 *             conversation opens; cached locally for the lifetime
 *             of this hook instance.
 *
 * Returns null while loading on first open of a group conversation,
 * so the caller can show "Carregando…" instead of an empty list.
 */
export function useConversationMembers(
  conversation: ApiConversationSummary | null,
  currentUserId: string | null,
): MentionableMember[] | null {
  const convId = conversation?.id ?? null;
  const isGroup = conversation?.type === 'group';

  /* O state local guarda apenas uma ref pro snapshot do cache —
   * mudanças no cache (via invalidate + re-fetch) notificam todos
   * os subscribers que disparam re-render. */
  const [groupMembers, setGroupMembers] = useState<ApiGroupMember[] | null>(
    () => (isGroup && convId ? membersCache.get(convId) ?? null : null),
  );

  useEffect(() => {
    if (!isGroup || !convId) {
      setGroupMembers(null);
      return;
    }
    let cancelled = false;

    // Subscriber pra mudanças do cache: outro componente invalidou,
    // ou veio um chat:thread:update — refresh local. Re-leio o
    // estado e re-fetch se invalidado.
    const onChange = () => {
      if (cancelled) return;
      const cached = membersCache.get(convId);
      if (cached) {
        setGroupMembers(cached);
      } else {
        // Cache foi invalidado — refetch.
        void fetchMembers(convId).catch((err) =>
          console.error('members re-fetch failed:', err),
        );
        setGroupMembers(null);
      }
    };
    subscribers.add(onChange);

    // Bootstrap: serve cache se disponível; senão fetch.
    const cached = membersCache.get(convId);
    if (cached) {
      setGroupMembers(cached);
    } else {
      setGroupMembers(null);
      fetchMembers(convId)
        .then((members) => {
          if (!cancelled) setGroupMembers(members);
        })
        .catch((err) => {
          if (!cancelled) console.error('mention members fetch failed:', err);
        });
    }

    return () => {
      cancelled = true;
      subscribers.delete(onChange);
    };
    // We deliberately depend on the conversation's id + type only —
    // re-fetching every time the parent rerenders with a new
    // conversation object reference would thrash the API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId, isGroup]);

  if (!conversation) return [];

  if (conversation.type === 'dm') {
    const u = conversation.otherUser;
    if (!u) return [];
    return [
      {
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        // DM otherUser doesn't carry email — synthesize a placeholder
        // so the autocomplete row's secondary line still has content.
        email: '',
      },
    ];
  }

  // Group branch — still loading, signal to caller.
  if (groupMembers === null) return null;
  return groupMembers
    .filter((m) => m.id !== currentUserId)
    .map((m) => ({
      id: m.id,
      name: m.name,
      avatarUrl: m.avatarUrl,
      email: m.email,
    }));
}
