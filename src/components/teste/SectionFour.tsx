'use client';

import styles from './SectionFour.module.css';

/**
 * Section 4 — circle constellation.
 *
 * Canvas SEM TEXTO. Existe apenas pra servir de gatilho de
 * scroll (id="section-4" / data-section="4") e fornecer um
 * fundo limpo onde os 12 avatares da circular constellation
 * (declarados na <AvatarConstellation />) podem aparecer e
 * formar o círculo.
 *
 * Sparkles removido — star field global em <GalaxyBackdrop />.
 */
export default function SectionFour() {
  return (
    <section
      id="section-4"
      data-section="4"
      className={styles.section}
    />
  );
}
