'use client';

import styles from './MobileFanverseHeader.module.css';

/**
 * Header mobile — VARIAÇÃO 2 (A/B). Reescrita do zero.
 *
 * Container: box preto translúcido, cantos 32px, 90% da largura da tela
 * e 136px de altura, flutuando centralizado no topo. Conteúdo em
 * construção — por enquanto a imagem da Ana à direita.
 */
export default function MobileFanverseHeader() {
  return (
    <header className={styles.header} aria-label="Fanverse Ana Castela">
      {/* Imagem da Ana — mesma altura do box, a 100px da borda direita. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/ana-header-mobile.png"
        alt="Ana Castela"
        className={styles.heroImg}
      />

      {/* Camada de gradiente preto→transparente sobre a imagem (direção
       *  ~11h25 no relógio). Confinada ao box (overflow:hidden) → respeita
       *  o border-radius. */}
      <div className={styles.imgGradient} aria-hidden="true" />
    </header>
  );
}
