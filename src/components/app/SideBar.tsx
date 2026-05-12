'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useUniverse } from '@/lib/universe/UniverseContext';
import styles from './SideBar.module.css';

const STORE_URL =
  'https://lojaanacastela.com.br/?srsltid=AfmBOoqO3lURzf9V03K4wnnoPrXa2sFOUu2r7DE9TJguEVZbdzGrWpka';

export default function SideBar() {
  const { config } = useUniverse();
  // Track artist-logo load failure so we fall back to the muusic icon
  // when the universe's logo file isn't on disk yet (or 404s for any
  // other reason). Resets when the universe changes.
  const [logoFailed, setLogoFailed] = useState(false);

  const useArtistLogo = !!config && !logoFailed;
  const logoSrc = useArtistLogo ? config.logoUrl : '/icon-muusic.svg';
  const logoAlt = useArtistLogo ? config.name : 'muusic';

  return (
    <aside className={styles.bar}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={logoSrc} // re-mounts on universe change → fresh onError eval
        src={logoSrc}
        alt={logoAlt}
        className={styles.logo}
        onError={() => setLogoFailed(true)}
      />

      {/* ── Mid stack: grid (switch universe) above the store link.
          Both share .iconBtn so the visual treatment stays consistent. */}
      <div className={styles.midStack}>
        <Link
          href="/app/select"
          className={styles.iconBtn}
          aria-label="Trocar universo"
          title="Trocar universo"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3"  y="3"  width="7" height="7" rx="1.5"
                  stroke="currentColor" strokeWidth="1.6" />
            <rect x="14" y="3"  width="7" height="7" rx="1.5"
                  stroke="currentColor" strokeWidth="1.6" />
            <rect x="3"  y="14" width="7" height="7" rx="1.5"
                  stroke="currentColor" strokeWidth="1.6" />
            <rect x="14" y="14" width="7" height="7" rx="1.5"
                  stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </Link>

        <a
          href={STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.iconBtn}
          aria-label="Loja oficial Ana Castela"
          title="Loja oficial"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9 8V6a3 3 0 0 1 6 0v2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
    </aside>
  );
}
