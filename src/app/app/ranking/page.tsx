'use client';

import { useRouter } from 'next/navigation';
import MobileFanverseSheet from '@/components/app/MobileFanverseSheet';

/**
 * Superfãs (Ranking) route — `/app/ranking`.
 *
 * Per product feedback "no mobile, refatore o bloco que aparece
 * ao clicar no ícone de coroa na navbar para ser inserido o
 * conteúdo que tem no box Fanverse Ana Castela com extamente as
 * mesmas informações, hierarquia de dados, etc.": antes essa
 * rota renderizava o SuperfansPanel; agora monta o
 * MobileFanverseSheet, que reusa as exports do ArtistBox
 * (RankingTabContent, BenefitsTabContent, MISSION_META, etc.)
 * pra entregar paridade exata com o desktop Box Fanverse.
 *
 * Default tab = 'ranking' porque a entrada principal é o
 * crown do BottomNav que conceitualmente leva pro leaderboard
 * de Superfãs.
 */
export default function RankingPage() {
  const router = useRouter();
  return (
    <MobileFanverseSheet
      open
      onClose={() => router.push('/app')}
      defaultTab="ranking"
    />
  );
}
