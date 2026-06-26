'use client';

import styles from './MobileFanverseHeader.module.css';

/**
 * Header mobile — VARIAÇÃO 2 (A/B). Reescrita do zero.
 *
 * Etapa 1 — o container: box preto translúcido, cantos 32px, 80% da
 * largura da tela e 194px de altura, flutuando centralizado no topo.
 * O conteúdo (texto/orbe/etc) entra nas próximas etapas.
 */
export default function MobileFanverseHeader() {
  return <header className={styles.header} aria-label="Fanverse Ana Castela" />;
}
