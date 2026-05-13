'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUniverse } from '@/lib/universe/UniverseContext';
import { UNIVERSES, type UniverseConfig } from '@/lib/universe/universes';
import styles from './page.module.css';

/**
 * Universe selection screen — the post-login gate where the user picks
 * which artist's Fanverse they want to enter. The choice is persisted
 * in localStorage via UniverseContext; subsequent /app visits skip
 * this screen and land directly in the chosen universe. The page is
 * also reachable from the sidebar grid icon as a "trocar universo"
 * affordance.
 */
export default function UniverseSelectPage() {
  const { user, loading: authLoading } = useAuth();
  const { setUniverse, hydrated } = useUniverse();
  const router = useRouter();

  // Not logged in → bounce to the auth screen. We DON'T auto-redirect
  // when the user already has a universe — the page is also reached
  // intentionally via the sidebar grid icon (= "trocar universo"), and
  // bouncing back to /app would defeat the whole purpose.
  useEffect(() => {
    if (authLoading || !hydrated) return;
    if (!user) router.replace('/auth');
  }, [authLoading, hydrated, user, router]);

  // Generate the starfield once per visit. Hand-tuned: 80 dots is
  // enough to feel dense without taxing the renderer. Each gets a
  // random size, opacity and twinkle delay so the field shimmers
  // organically.
  const stars = useMemo(
    () =>
      Array.from({ length: 80 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 0.6 + Math.random() * 1.6,
        opacity: 0.35 + Math.random() * 0.55,
        delay: Math.random() * -4, // negative so animations are mid-cycle on mount
        duration: 3 + Math.random() * 4,
      })),
    [],
  );

  const handlePick = (config: UniverseConfig) => {
    setUniverse(config.id);
    // Hard navigation — see fix(universe-select) commit notes. Soft
    // router.replace produced an appendChild race between the select
    // screen unmounting and /app's Mapbox + confetti children mounting.
    if (typeof window !== 'undefined') {
      window.location.assign('/app');
    }
  };

  const list = Object.values(UNIVERSES);

  return (
    <div className={styles.scrim}>
      {/* Starfield — animated twinkling dots matching the Mapbox globe's
          space-color aesthetic. Lives below everything else (z-index 0). */}
      <div className={styles.starfield} aria-hidden="true">
        {stars.map((s, i) => (
          <span
            key={i}
            className={styles.star}
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              ['--star-opacity' as string]: s.opacity.toFixed(2),
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Two-column layout: intro text left, universe cards right. */}
      <div className={styles.layout}>
        <header className={styles.intro}>
          <h1 className={styles.title}>
            Escolha o seu
            <br />
            Fanverse
          </h1>
          <p className={styles.lead}>
            Cada Fanverse reúne uma comunidade de superfãs em torno de um
            artista. Escolha por onde começar — você pode trocar a qualquer
            momento depois pelo ícone na lateral.
          </p>
        </header>

        <div className={styles.grid}>
          {list.map((u) => (
            <article key={u.id} className={styles.card}>
              <button
                type="button"
                className={styles.cardClickable}
                onClick={() => handlePick(u)}
                aria-label={`Entrar no Fanverse ${u.name}`}
              >
                <div
                  className={styles.cover}
                  style={{ backgroundImage: `url(${u.coverUrl})` }}
                />
                {/* Single gradient block sitting behind the text. Stronger
                    than the previous overlay so the name + description
                    read cleanly on any cover shot. */}
                <div className={styles.textBackdrop} />
                <div className={styles.cardContent}>
                  <h2 className={styles.cardName}>{u.name}</h2>
                  <p className={styles.cardDesc}>{u.description}</p>
                  <span className={styles.cta}>
                    Acessar
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

              {/* Secondary CTA — sits OUTSIDE the card (below it) so
                  the universes that opt-in via secondaryCtaLabel get
                  a visually distinct second affordance. Click handler
                  fires handlePick directly; no bubbling concern since
                  it's now a sibling, not a descendant. */}
              {u.secondaryCtaLabel && (
                <button
                  type="button"
                  className={styles.secondaryCta}
                  onClick={() => handlePick(u)}
                >
                  {u.secondaryCtaLabel}
                </button>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
