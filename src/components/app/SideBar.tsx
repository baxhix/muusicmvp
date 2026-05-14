'use client';

import { useState } from 'react';
import { useUniverse } from '@/lib/universe/UniverseContext';
import styles from './SideBar.module.css';

/**
 * Left-edge vertical strip. Now down to a single duty: render the
 * current Fanverse's logo (with a graceful fallback to the muusic
 * mark when the artist's SVG fails to load).
 *
 * The grid (switch universe) + bag (official store) icons that
 * used to live below the logo were moved into the TopBar user
 * drawer (right-side avatar → "Fanverse" section) so the left
 * column stays clean.
 */
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
    </aside>
  );
}
