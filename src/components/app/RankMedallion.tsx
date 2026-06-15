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
  /** Ajusta só o offset do canto conforme o avatar (sm/md ~32–64px, lg ~118px). */
  size?: RankMedallionSize;
  /**
   * Canto onde o selo ancora. Default 'tr' (superior-direito).
   * Use 'tl' (superior-esquerdo) onde o canto direito já é ocupado
   * por verified badge / presença (ex.: linhas de chat).
   */
  corner?: 'tr' | 'tl';
}

/**
 * Selo de rank sobreposto no canto do avatar. #1 = selo cinza,
 * #2–10 = selo dourado (estrela) — imagens em /public/badges, 18px
 * de largura. O selo já tem forma e brilho próprios, então não há
 * disco/anel. Fica no canto oposto ao dot verde de presença.
 */
function RankMedallionBase({
  position,
  size = 'sm',
  corner = 'tr',
}: RankMedallionProps) {
  if (position == null || position < 1 || position > 10) return null;
  const isChampion = position === 1;
  const src = isChampion ? '/badges/seal-gray.png' : '/badges/seal-gold.png';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={isChampion ? 'Top 1 do ranking' : `Top 10 · #${position} do ranking`}
      className={`${styles.medallion} ${styles[size]} ${corner === 'tl' ? styles.tl : ''}`}
      draggable={false}
    />
  );
}

export const RankMedallion = memo(RankMedallionBase);
export default RankMedallion;
