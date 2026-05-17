'use client';

import { useParams, useRouter } from 'next/navigation';
import ProfilePanel from '@/components/app/ProfilePanel';
import { useDisplayedProfile } from '@/hooks/useDisplayedProfile';
import { useAppShell } from '@/lib/app/AppShellContext';

/**
 * Outro usuário — `/app/u/[id]`.
 *
 * Phase 2: was the same singleton modal as own profile, branched
 * by `viewingUserId`. Now its own route with the user id in the
 * URL so the surface is deep-linkable (shareable profile links
 * are a growth lever).
 *
 * Globe pin clicks navigate here via router.push from page.tsx
 * (Phase 2 callsite update). The `onSendMessage` callback opens
 * a DM via the shell's chat hook and routes to /app/chat.
 */
export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const userId = params?.id ?? null;
  const { user, isOwnProfile } = useDisplayedProfile(userId);
  const { chat } = useAppShell();

  return (
    <ProfilePanel
      user={user}
      isOwnProfile={isOwnProfile}
      onClose={() => router.push('/app')}
      onSendMessage={(uid) => {
        // Open or create the DM, then drop the user on /app/chat
        // where the LiveChatPanel will pick up `chat.activeId`.
        chat.openDmWith(uid);
        router.push('/app/chat');
      }}
      onWave={(uid, label) => {
        // Placeholder until POST /api/wave ships.
        console.log(`wave → ${uid} (${label})`);
      }}
      onReport={(uid, label) => {
        console.log(`report → ${uid} (${label})`);
      }}
    />
  );
}
