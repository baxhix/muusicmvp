import styles from './MobileFanverseHeader.module.css';

/**
 * Header mobile — VARIAÇÃO 2 (A/B). Recriação do zero.
 *
 * Etapa 1 — container: box dark flutuante no topo (overlay fixo, não
 * empurra o globo da home). Full-width com 28px de padding nas laterais
 * e no topo, cantos 16px, borda cinza sutil e sombra externa pra dar
 * profundidade. O conteúdo (textos + orbe) entra nas próximas etapas.
 */
export default function MobileFanverseHeader() {
  return <header className={styles.header} aria-label="Fanverse Ana Castela" />;
}
