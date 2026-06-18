'use client';

import { useRouter } from 'next/navigation';
import CommunityPanel from '@/components/app/CommunityPanel';
import { useAppShell } from '@/lib/app/AppShellContext';

/**
 * Comunidades route — `/app/comunidades`.
 *
 * Phase 2 of the route refactor: this surface used to be a
 * singleton modal toggled by `setShowCommunity(true)`. Now it's
 * its own route. The panel itself is unchanged — we just pass
 * `open={true}` and route back to `/app` on close.
 *
 * Future deep routes (`/app/comunidades/[slug]`, `.../topicos/[id]`)
 * can plug in as sibling pages; the CommunityPanel's internal
 * view-state machine still handles the drill-down for now.
 */
export default function CommunidadesPage() {
  const router = useRouter();
  const { setFeedOpen } = useAppShell();
  return (
    <CommunityPanel
      open
      /* Ao fechar, garante o feed aberto (o feed deve permanecer
       *  aberto ao sair de Comunidades). */
      onClose={() => { setFeedOpen(true); router.push('/app'); }}
    />
  );
}
