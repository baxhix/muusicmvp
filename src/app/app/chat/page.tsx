'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConversationsSidebar from '@/components/app/ConversationsSidebar';
import LiveChatPanel from '@/components/app/LiveChatPanel';
import UserPicker from '@/components/app/UserPicker';
import GroupMembersPanel from '@/components/app/GroupMembersPanel';
import { useAppShell } from '@/lib/app/AppShellContext';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  FAKE_ANA_CONVERSATION_ID,
  FAKE_ANA_NOW_PLAYING,
  FAKE_CENTRAL_CONVERSATION_ID,
  FAKE_CENTRAL_NOW_PLAYING,
} from '@/lib/fakeAna';

/**
 * Chat route — `/app/chat`.
 *
 * Phase 2 of the route refactor: the conversations sidebar +
 * the open-thread detail panel are now the page content here
 * instead of overlays mounted by /app/page.tsx. The route also
 * owns the local UI state that the chat surface needs:
 *
 *   - UserPicker (for "Nova conversa" / "Novo grupo")
 *   - GroupMembersPanel (for the kebab "Ver membros" entry)
 *   - The "add member to group" sub-state
 *
 * Live presence + chat realtime + onlineUserIds come from the
 * shell provider so the websocket isn't re-established on each
 * mount.
 *
 * Closing the sidebar (× or Escape) routes back to /app. The
 * detail panel's close just clears the active conversation —
 * the user stays in /app/chat looking at the list.
 */
export default function ChatPage() {
  const router = useRouter();
  const { chat, liveUsers, onlineUserIds } = useAppShell();
  const { user: authUser } = useAuth();

  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [addingMemberToGroup, setAddingMemberToGroup] =
    useState<string | null>(null);

  const activeConversation =
    chat.conversations.find((c) => c.id === chat.activeId) ?? null;

  // Now-playing for the OTHER side of an active DM. Fakes always
  // show their featured tracks regardless of presence; real users
  // fall through to the live roster.
  const activeOtherNowPlaying = (() => {
    if (activeConversation?.id === FAKE_ANA_CONVERSATION_ID) {
      return FAKE_ANA_NOW_PLAYING;
    }
    if (activeConversation?.id === FAKE_CENTRAL_CONVERSATION_ID) {
      return FAKE_CENTRAL_NOW_PLAYING;
    }
    const otherId = activeConversation?.otherUser?.id;
    if (!otherId) return null;
    const liveOther = liveUsers.find((u) => u.id === otherId);
    if (!liveOther?.nowPlaying) return null;
    return {
      title: liveOther.nowPlaying.title,
      artist: liveOther.nowPlaying.artist,
    };
  })();

  return (
    <>
      <ConversationsSidebar
        open
        conversations={chat.conversations}
        activeId={chat.activeId}
        onlineUserIds={onlineUserIds}
        onClose={() => router.push('/app')}
        onOpenConversation={chat.open}
        onNewConversation={() => setShowUserPicker(true)}
        onNewGroup={() => setShowGroupPicker(true)}
      />

      <LiveChatPanel
        conversation={activeConversation}
        messages={chat.messages}
        loading={chat.loadingMessages}
        otherNowPlaying={activeOtherNowPlaying}
        onClose={chat.close}
        onSend={chat.send}
        onReact={chat.react}
        onOpenMembers={() => setShowGroupMembers(true)}
        onLeaveGroup={async () => {
          if (!activeConversation || !authUser) return;
          if (!window.confirm('Sair desse grupo? Você não receberá mais mensagens dele.')) return;
          try {
            const res = await fetch(
              `/api/conversations/${activeConversation.id}/members/${authUser.id}`,
              { method: 'DELETE', credentials: 'include' },
            );
            if (!res.ok) {
              window.alert('Não foi possível sair do grupo.');
              return;
            }
            chat.close();
          } catch (err) {
            console.error('leave group failed:', err);
          }
        }}
      />

      <GroupMembersPanel
        open={showGroupMembers && activeConversation?.type === 'group'}
        conversationId={activeConversation?.type === 'group' ? activeConversation.id : null}
        currentUserId={authUser?.id ?? ''}
        myRole={activeConversation?.myRole ?? null}
        onClose={() => setShowGroupMembers(false)}
        onAddMember={() => {
          if (!activeConversation) return;
          setAddingMemberToGroup(activeConversation.id);
        }}
        onLeft={() => {
          setShowGroupMembers(false);
          chat.close();
          void chat.refreshConversations();
        }}
        onImageUpdated={() => {
          void chat.refreshConversations();
        }}
      />

      <UserPicker
        open={showUserPicker}
        onClose={() => setShowUserPicker(false)}
        onPick={(uid) => {
          setShowUserPicker(false);
          chat.openDmWith(uid);
        }}
      />

      <UserPicker
        open={showGroupPicker}
        mode="group"
        onClose={() => setShowGroupPicker(false)}
        /* Lista default em group mode = DM partners das
         * conversas recentes (ordenados por última mensagem
         * desc) per product feedback "liste os usuários em
         * ordem de que já tive conversas abertas, não somente
         * os que estiverem online". */
        recentConversations={chat.conversations}
        onCreateGroup={async ({ name, memberIds }) => {
          await chat.createGroup({ name, memberIds });
          setShowGroupPicker(false);
        }}
      />

      {/* "Adicionar membro" — single-pick UserPicker that POSTs to
          /api/conversations/:id/members. Reuses the default
          single-pick mode (no `mode` prop). */}
      <UserPicker
        open={addingMemberToGroup !== null}
        onClose={() => setAddingMemberToGroup(null)}
        onPick={async (uid) => {
          const convId = addingMemberToGroup;
          if (!convId) return;
          try {
            const res = await fetch(
              `/api/conversations/${convId}/members`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId: uid }),
              },
            );
            if (!res.ok) {
              const data = (await res.json().catch(() => ({}))) as { error?: string };
              window.alert(
                data.error === 'user_not_found'
                  ? 'Usuário não encontrado.'
                  : 'Não foi possível adicionar o membro.',
              );
              return;
            }
            setAddingMemberToGroup(null);
            setShowGroupMembers(false);
            setTimeout(() => setShowGroupMembers(true), 30);
            void chat.refreshConversations();
          } catch (err) {
            console.error('add member failed:', err);
          }
        }}
      />
    </>
  );
}
