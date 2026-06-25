'use client';

import Sparkles from './Sparkles';
import styles from './SectionFanPurpose.module.css';

/**
 * Section "Sou Fã" — manifesto. Uma única frase de impacto (Borscha,
 * grande, apelo emocional) resumindo o propósito de ser fã no Fanverse.
 */
export default function SectionFanPurpose() {
  return (
    <section
      id="section-fan-purpose"
      data-section="fan-purpose"
      className={styles.section}
      aria-label="Sou Fã"
    >
      <Sparkles count={9} seed={23} />
      <p className={styles.manifesto}>
        Ser fã é pertencer a algo maior que você{' '}
        <span className={styles.heart} role="img" aria-label="amor">❤️</span>{' '}
        e o Fanverse transforma essa paixão em conexão real, presença e
        recompensa.
      </p>
    </section>
  );
}
