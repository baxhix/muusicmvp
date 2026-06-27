'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRanking } from '@/hooks/useRanking';
import FanverseCore from '@/components/animations/FanverseCore';
import styles from './MobileFanverseHeader.module.css';

/** Recorte da Ana (fundo transparente) dentro do box. */
const HEADER_IMAGE = '/ana-04-header.png';

/** Abre o Fanverse Search (mesmo gatilho do orbe nas outras surfaces). */
function openSearch() {
  try {
    window.dispatchEvent(new CustomEvent('app:open-fanverse-search'));
  } catch {
    /* SSR */
  }
}

/** Fanpoints → abre o Ranking Fanverse. */
function openRanking() {
  try {
    window.dispatchEvent(
      new CustomEvent('app:open-ranking-store', { detail: { screen: 'ranking' } }),
    );
  } catch {
    /* SSR */
  }
}

/**
 * Header mobile — VARIAÇÃO 2 (A/B). Recriação do zero.
 *
 * Box dark flutuante (overlay fixo) com gradiente translúcido + frosted
 * glass, a imagem da Ana à direita do centro, e por cima de tudo o
 * conteúdo: Fanverse / Ana Castela / Fanpoints + Top1 (embaixo-esquerda)
 * e o orbe no canto inferior-direito.
 */
export default function MobileFanverseHeader() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  const fanpoints = profile?.fanpoints ?? 0;

  const { ranking } = useRanking(true);
  const myRank = user ? ranking.findIndex((r) => r.userId === user.id) + 1 : 0;
  const rankBadge = myRank === 1 ? 'Top 1' : myRank > 1 ? `#${myRank}º` : '';

  return (
    <header className={styles.header} aria-label="Fanverse Ana Castela">
      {/* Imagem da Ana — altura do box, começando 30px à direita do centro. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={HEADER_IMAGE} alt="Ana Castela" className={styles.heroImg} />

      {/* Sombra diagonal sutil (black → transparente, de cima pra baixo)
       *  por cima da imagem. */}
      <div className={styles.imgShade} aria-hidden="true" />

      {/* Fade preto de baixo pra cima — escurece só a base da imagem,
       *  deixa o rosto (topo) iluminado. Acima da imagem, abaixo do texto. */}
      <div className={styles.bottomFade} aria-hidden="true" />

      {/* Conteúdo — acima de tudo, ancorado embaixo-esquerda. */}
      <div className={styles.content}>
        <span className={styles.eyebrow}>Fanverse</span>
        <span className={styles.title}>Ana Castela</span>
        <button type="button" className={styles.meta} onClick={openRanking}>
          <span className={styles.metaValue}>
            {fanpoints.toLocaleString('pt-BR')}
          </span>
          <span className={styles.metaLabel}>Fanpoints</span>
          {rankBadge && <span className={styles.metaRank}>{rankBadge}</span>}
        </button>
      </div>

      {/* Orbe — lado direito, mais pra baixo. */}
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
