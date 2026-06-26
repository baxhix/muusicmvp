'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRanking } from '@/hooks/useRanking';
import FanverseCore from '@/components/animations/FanverseCore';
import styles from './MobileFanverseHeader.module.css';

/**
 * Header mobile — VARIAÇÃO 2 (A/B).
 *
 * Box flutuante (95% × 134px, cantos 16px) com `header-ana.png` como
 * background (arte completa: Ana + gradientes já embutidos) e, por cima,
 * só o conteúdo em texto: Fanverse / Ana Castela / Fanpoints + Top1
 * (ancorado embaixo-esquerda) e o orbe à direita.
 *
 * Gatilhos reaproveitados:
 *   - orbe → `app:open-fanverse-search`
 *   - Fanpoints → `app:open-ranking-store` (Ranking Fanverse)
 */
export default function MobileFanverseHeader() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  const fanpoints = profile?.fanpoints ?? 0;

  const { ranking } = useRanking(true);
  const myRank = user ? ranking.findIndex((r) => r.userId === user.id) + 1 : 0;
  const rankBadge = myRank === 1 ? 'Top 1' : myRank > 1 ? `#${myRank}º` : '';

  const openSearch = () => {
    try {
      window.dispatchEvent(new CustomEvent('app:open-fanverse-search'));
    } catch {
      /* SSR */
    }
  };
  const openRanking = () => {
    try {
      window.dispatchEvent(
        new CustomEvent('app:open-ranking-store', { detail: { screen: 'ranking' } }),
      );
    } catch {
      /* SSR */
    }
  };

  return (
    <header className={styles.header} aria-label="Fanverse Ana Castela">
      {/* Conteúdo — acima da imagem de background, ancorado embaixo-esquerda. */}
      <div className={styles.content}>
        <span className={styles.eyebrow}>Fanverse</span>
        <div className={styles.titleRow}>
          <span className={styles.title}>Ana Castela</span>
        </div>
        <button type="button" className={styles.meta} onClick={openRanking}>
          <span className={styles.metaValue}>
            {fanpoints.toLocaleString('pt-BR')}
          </span>
          <span className={styles.metaLabel}>Fanpoints</span>
          {rankBadge && <span className={styles.metaRank}>{rankBadge}</span>}
        </button>
      </div>

      {/* Orbe — a 28px da extremidade direita, acima de tudo. */}
      <button
        type="button"
        className={styles.orb}
        onClick={openSearch}
        aria-label="Abrir Fanverse Search"
      >
        <FanverseCore />
      </button>
    </header>
  );
}
