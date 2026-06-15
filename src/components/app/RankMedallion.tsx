'use client';

import { memo } from 'react';
import styles from './RankMedallion.module.css';

export type RankMedallionSize = 'sm' | 'md' | 'lg';

interface RankMedallionProps {
  /**
   * Posição 1-based do usuário no ranking geral. `null`/`0`/`> 10`
   * → nada renderiza (Parte 1 só decora o Top 10).
   */
  position: number | null | undefined;
  /** Casa o tamanho com o avatar: sm ~32–44px, md ~44–64px, lg ~118px. */
  size?: RankMedallionSize;
  /**
   * Canto onde o medalhão ancora. Default 'tr' (superior-direito).
   * Use 'tl' (superior-esquerdo) onde o canto direito já é ocupado
   * por verified badge / presença (ex.: linhas de chat).
   */
  corner?: 'tr' | 'tl';
}

/**
 * Medalhão de rank sobreposto no canto superior-direito do avatar.
 * Coroa no #1, estrela dourada no #2–10. Fica no canto OPOSTO ao dot
 * verde de presença (inferior-direito), em ouro, com z-index acima —
 * cor e canto diferentes → nunca confunde com o "online".
 *
 * O pai precisa ser `position: relative` (todos os wrappers de avatar
 * onde isto é usado já são). `pointer-events: none` pra não bloquear o
 * clique no avatar/nome (que costumam ser Links).
 */
function RankMedallionBase({
  position,
  size = 'sm',
  corner = 'tr',
}: RankMedallionProps) {
  if (position == null || position < 1 || position > 10) return null;
  const isChampion = position === 1;
  return (
    <span
      className={`${styles.medallion} ${styles[size]} ${isChampion ? styles.champion : ''} ${corner === 'tl' ? styles.tl : ''}`}
      aria-label={isChampion ? 'Top 1 do ranking' : `Top 10 · #${position} do ranking`}
      title={isChampion ? 'Top 1' : `Top 10 · #${position}`}
    >
      {isChampion ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <linearGradient id="rankCrownGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff6cf" />
              <stop offset="48%" stopColor="#f4cb4b" />
              <stop offset="100%" stopColor="#a9740d" />
            </linearGradient>
          </defs>
          <path
            fill="url(#rankCrownGold)"
            d="M4 18h16v2.4H4V18zM4 7.2l4.3 3 3.7-5.8 3.7 5.8 4.3-3-1.6 8.8H5.6L4 7.2z"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95L12 2.6z" />
        </svg>
      )}
    </span>
  );
}

export const RankMedallion = memo(RankMedallionBase);
export default RankMedallion;
