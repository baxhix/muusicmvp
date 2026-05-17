'use client';

import { useRouter } from 'next/navigation';
import SuperfansPanel from '@/components/app/SuperfansPanel';

/**
 * Superfãs (Ranking) route — `/app/ranking`.
 *
 * Phase 2: was a centered modal toggled by `setShowSuperfans`.
 * Now reachable via the top-rail crown icon → router.push.
 */
export default function RankingPage() {
  const router = useRouter();
  return (
    <SuperfansPanel open onClose={() => router.push('/app')} />
  );
}
