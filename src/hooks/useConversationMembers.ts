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
  const [groupMembers, setGroupMembers] = useState<ApiGroupMember[] | null>(
    null,
  );

  useEffect(() => {
    if (!conversation || conversation.type !== 'group') {
      setGroupMembers(null);
      return;
    }
    let cancelled = false;
    setGroupMembers(null);
    api
      .get<{ members: ApiGroupMember[] }>(
        `/api/conversations/${conversation.id}/members`,
      )
      .then((res) => {
        if (!cancelled) setGroupMembers(res.members);
      })
      .catch((err) => {
        if (!cancelled) console.error('mention members fetch failed:', err);
      });
    return () => {
      cancelled = true;
    };
    // We deliberately depend on the conversation's id + type only —
    // re-fetching every time the parent rerenders with a new
    // conversation object reference would thrash the API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id, conversation?.type]);

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
