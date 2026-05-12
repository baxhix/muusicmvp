'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUniverse } from '@/lib/universe/UniverseContext';
import { UNIVERSES, type UniverseConfig } from '@/lib/universe/universes';
import styles from './page.module.css';

/**
 * Universe selection screen — the post-login gate where the user picks
 * which artist's Fanverse they want to enter. The choice is persisted
 * in localStorage via UniverseContext; subsequent /app visits skip
 * this screen and land directly in the chosen universe.
 *
 * Until the V1 differentiation lands (per-universe palette, curated
 * content, etc.) all universes load the same app shell — the only
 * difference today is the SideBar logo swap.
 */
export default function UniverseSelectPage() {
  const { user, loading: authLoading } = useAuth();
  const { setUniverse, hydrated } = useUniverse();
  const router = useRouter();

  // Not logged in → bounce to the auth screen. We DON'T auto-redirect
  // when the user already has a universe — the page is also reached
  // intentionally via the sidebar grid icon (= "trocar universo"), and
  // bouncing back to /app would defeat the whole purpose. The post-
  // login first-time gate lives in /app/page.tsx, which redirects HERE
  // when no universe is picked yet; the reverse direction stays manual.
  useEffect(() => {
    if (authLoading || !hydrated) return;
    if (!user) router.replace('/auth');
  }, [authLoading, hydrated, user, router]);

  const handlePick = (config: UniverseConfig) => {
    setUniverse(config.id);
    // Hard navigation instead of router.replace. The soft client
    // transition was producing a race where /app/select unmounts
    // while /app mounts in the same React commit — Mapbox /
    // canvas-confetti / other DOM-heavy children would fire
    // appendChild on a target already torn down ("Cannot read
    // properties of undefined (reading 'appendChild')").
    //
    // location.assign discards the whole React tree, then /app
    // mounts fresh with the universe already persisted in
    // localStorage — same outcome the user expects, zero race.
    if (typeof window !== 'undefined') {
      window.location.assign('/app');
    }
  };

  const list = Object.values(UNIVERSES);

  return (
    <div className={styles.scrim}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Escolha seu universo</span>
        <h1 className={styles.title}>
          Onde sua tribo <em>está</em>.
        </h1>
        <p className={styles.lead}>
          Cada Fanverse reúne uma comunidade de superfãs em torno de um
          artista. Escolha por onde começar — você pode trocar a qualquer
          momento depois.
        </p>
      </div>

      <div className={styles.grid}>
        {list.map((u) => (
          <button
            key={u.id}
            type="button"
            className={styles.card}
            onClick={() => handlePick(u)}
            aria-label={`Entrar no Fanverse ${u.name}`}
          >
            <div
              className={styles.cover}
              style={{ backgroundImage: `url(${u.coverUrl})` }}
            >
              <div className={styles.coverOverlay} />
              <div className={styles.coverFooter}>
                <span className={styles.cardName}>{u.name}</span>
                <span
                  className={styles.cardTag}
                  style={{
                    background: `${u.accentColor}40`,
                    border: `1px solid ${u.accentColor}80`,
                    color: '#ffffff',
                  }}
                >
                  {u.tag}
                </span>
              </div>
            </div>

            <div className={styles.cardBody}>
              <p className={styles.cardDesc}>{u.description}</p>
              <span className={styles.cta}>
                Entrar
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M6 3l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
          </button>
        ))}
      </div>

      <p className={styles.footer}>
        Por enquanto, todos os universos compartilham o mesmo ambiente.
        Em breve cada um terá curadoria, cores e descobertas exclusivas.
      </p>
    </div>
  );
}
