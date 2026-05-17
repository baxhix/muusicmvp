'use client';

import { useRouter } from 'next/navigation';
import SuperchatPanel from '@/components/app/SuperchatPanel';
import { useAppShell } from '@/lib/app/AppShellContext';

/**
 * Superchat route — `/app/superchat`.
 *
 * Phase 2: was a singleton modal. Now its own route. The superchat
 * conversation is the only group thread in the chat list; we pluck
 * it from the shell context to drive the `onMarkRead` side-effect.
 */
export default function SuperchatPage() {
  const router = useRouter();
  const { chat } = useAppShell();
  const superchat = chat.conversations.find((c) => c.type === 'group') ?? null;
  return (
    <SuperchatPanel
      open
      onClose={() => router.push('/app')}
      onMarkRead={() => {
        if (superchat) void chat.markRead(superchat.id);
      }}
    />
  );
}
