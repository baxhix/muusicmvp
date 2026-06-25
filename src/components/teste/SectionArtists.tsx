'use client';

import Link from 'next/link';
import Sparkles from './Sparkles';
import styles from './SectionArtists.module.css';

/**
 * Section "Para Artistas" — pivô da narrativa do fã pro artista. H1 grande
 * (Borscha, mesmo shimmer dos outros headlines da landing) + frase de apoio
 * + CTA pra /para-artistas (Link interno — App Router exige <Link>, não <a>).
 */
export default function SectionArtists() {
  return (
    <section
      id="section-artists"
      data-section="artists"
      className={styles.section}
      aria-label="Para Artistas"
    >
      <Sparkles count={11} seed={47} />

      <div className={styles.inner}>
        <p className={styles.eyebrow}>Do outro lado do palco</p>
        <h2 className={styles.headline}>Para Artistas</h2>
        <p className={styles.phrase}>
          Transforme ouvintes em superfãs e leve sua comunidade pra um
          universo só seu.
        </p>
        <Link href="/para-artistas" className={styles.cta}>
          Conhecer o Fanverse pra artistas
        </Link>
      </div>
    </section>
  );
}
