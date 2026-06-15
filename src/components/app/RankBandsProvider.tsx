'use client';

import { createContext, useContext, useMemo } from 'react';
import { useRanking } from '@/hooks/useRanking';

interface RankBandsValue {
  /** Posição 1-based do usuário no ranking geral, ou null se fora dele. */
  rankOf: (userId: string | null | undefined) => number | null;
}

const RankBandsContext = createContext<RankBandsValue>({
  rankOf: () => null,
});

/**
 * Fonte única do ranking geral pro medalhão de rank (coroa/estrela)
 * acompanhar a foto do usuário em QUALQUER superfície (chat,
 * comentários, superchat, TopBar, menu…), sem cada uma refazer o
 * fetch. Faz UM `useRanking(true)` no shell e expõe `rankOf(userId)`
 * (= índice no ranking + 1) via contexto.
 *
 * Consumidores fora do provider recebem o default `() => null` →
 * nenhum medalhão (seguro, sem crash).
 */
export function RankBandsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ranking } = useRanking(true);
  const value = useMemo<RankBandsValue>(() => {
    const byId = new Map<string, number>();
    ranking.forEach((r, i) => byId.set(r.userId, i + 1));
    return {
      rankOf: (userId) => (userId ? byId.get(userId) ?? null : null),
    };
  }, [ranking]);

  return (
    <RankBandsContext.Provider value={value}>
      {children}
    </RankBandsContext.Provider>
  );
}

export function useRankBands(): RankBandsValue {
  return useContext(RankBandsContext);
}
