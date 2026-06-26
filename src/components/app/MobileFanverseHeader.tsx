'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRanking } from '@/hooks/useRanking';
import FanverseCore from '@/components/animations/FanverseCore';
import styles from './MobileFanverseHeader.module.css';

/** Arte completa do header (composição pronta — fundo + Ana + gradiente). */
const HEADER_IMAGE = '/header.webp';

/**
 * Header mobile — VARIAÇÃO 2 (A/B).
 *
 * Adapta o card "Fanverse Ana Castela" do desktop (fold do ArtistBox)
 * pra uma experiência nativa de mobile: imagem da Ana à esquerda,
 * gradiente preto por cima pra contraste, conteúdo sobreposto
 * (Fanverse · Ana Castela + Fanpoints + rank) e o orbe (FanverseCore)
 * à direita — mesma linguagem visual do desktop.
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
  const rankBadge = myRank === 1 ? 'Top1' : myRank > 1 ? `#${myRank}º` : '';

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
    <header className={styles.header}>
      {/* Arte completa do header como background (já traz fundo +
       *  gradiente + Ana integrados). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HEADER_IMAGE}
        alt="Ana Castela"
        className={`${styles.heroImg} ${styles.heroImgActive}`}
      />

      {/* Conteúdo sobreposto, ancorado no topo-esquerdo. */}
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

      {/* Orbe à direita — mesma linguagem do desktop. */}
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
