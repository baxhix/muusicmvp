'use client';

import { useEffect, useMemo, useState } from 'react';
import { globeStore } from '@/lib/globeStore';
import { useLiveUsers } from '@/hooks/useLiveUsers';
import { track } from '@/lib/analytics';
import { getSocket } from '@/lib/socket/client';
import type { ApiOnlineUser } from '@/lib/api/types';
import styles from './FloatingUsers.module.css';

interface FloatingUser {
  id: string;
  name: string;
  city: string;
  song: string | null;
  artist: string | null;
  img: string;
  left: string;
  top: string;
  floatDuration: number;
  floatDelay: number;
  center?: [number, number];
  zoom?: number;
}

/** Stable 32-bit FNV-1a hash. Used to give each user id a deterministic
 *  numeric rank and to derive jitter / animation offsets. */
function stableHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Extract up to 4 derived `[0, 1)` floats from a base hash without
 *  re-hashing the seed string each time. Used for the secondary
 *  jitter + float-animation params. */
function derivedFloats(hash: number, count: number): number[] {
  let h = hash;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = Math.imul(h ^ (h >>> 13), 16777619);
    out.push(((h >>> 0) % 100000) / 100000);
  }
  return out;
}

/**
 * Distribute every visible online user into a stratified grid that
 * spans the safe area (left 8–68%, top 12–76%). Each user lands in
 * its OWN cell — no two users can hash into adjacent positions at
 * the same rim of the viewport, which was the source of the
 * "dois cards juntos no canto direito" complaint with the previous
 * per-user pure-hash projection.
 *
 * Algorithm:
 *   1. Stable-hash every user id.
 *   2. Sort by hash → deterministic order that mixes user ids
 *      evenly across the index space (no "all early ids land
 *      in the first cells").
 *   3. Compute a grid size from N. Bias toward more rows than
 *      columns on the visible area so badge widths (≈ 35-45%
 *      on mobile) don't have to share a row at narrow widths.
 *   4. Walk the sorted list, assigning each user to its row+col.
 *   5. Within the cell, jitter ±30% of cell dimensions from
 *      derived hash bits so positions feel organic, not gridded.
 *
 * The horizontal range remains 8-68% (60% of viewport width)
 * because the LiveChatStack dock sits at right ≈14-18px with
 * ~44px avatars stacked — anything past 68% would hide behind
 * it. Vertical range is 12-76% (64% of height) for the same
 * top/bottom safe-area reasoning. */
function distributeFloatingUsers(users: ApiOnlineUser[]): FloatingUser[] {
  if (users.length === 0) return [];

  const hashed = users.map((u) => ({ user: u, hash: stableHash(u.id) }));
  // Stable order independent of fetch order.
  hashed.sort((a, b) => a.hash - b.hash);

  const N = hashed.length;
  // Grid: bias rows > cols so each user has more horizontal
  // breathing room (mobile badges are wider than they are tall).
  // sqrt(N * heightRatio/widthRatio) for cols, ceil(N/cols) for rows.
  // Visible area ratio: 60% / 64% ≈ 0.94 — roughly square, so the
  // grid is close to sqrt(N) × sqrt(N) with a +1 row bias.
  const cols = Math.max(2, Math.ceil(Math.sqrt(N * 0.85)));
  const rows = Math.ceil(N / cols);

  return hashed.map(({ user, hash }, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    // Cell center in [0, 1).
    const xCenter = (col + 0.5) / cols;
    const yCenter = (row + 0.5) / rows;

    // ±30% of cell-size jitter, deterministic from hash bits.
    const jitterX = (((hash & 0xff) / 255) - 0.5) * 0.6 / cols;
    const jitterY = ((((hash >>> 8) & 0xff) / 255) - 0.5) * 0.6 / rows;

    // Map cell-space [0, 1) → visible area [8, 68)% × [12, 76)%.
    const xPct = (xCenter + jitterX) * 60 + 8;
    const yPct = (yCenter + jitterY) * 64 + 12;

    // Float animation params (duration / delay) keep their existing
    // hash-derived behaviour so the visual breathing is identical
    // to before — only the static position changed.
    const [, , dur, del] = derivedFloats(hash, 4);

    return {
      id: user.id,
      name: user.name ?? 'Anônimo',
      city: [user.city, user.country].filter(Boolean).join(', ') || '—',
      song: user.nowPlaying?.title ?? null,
      artist: user.nowPlaying?.artist ?? null,
      img: user.avatarUrl ?? '/avatar-placeholder.svg',
      left: `${xPct}%`,
      top: `${yPct}%`,
      floatDuration: 3.5 + dur * 1.8,
      floatDelay: -del * 4,
      center: user.lng != null && user.lat != null ? [user.lng, user.lat] : undefined,
      zoom: 10,
    };
  });
}

/**
 * Floating overlay badges for online users — anchored to deterministic
 * screen positions (not lat/lng) so they stay visible regardless of how
 * the globe is rotated. ALL real users are rendered at all times; there
 * is no cycling or max-visible cap. The list source is /api/users/online,
 * filtered to users with public-shareable identity.
 *
 * The Globe component also renders a Mapbox marker per user at their real
 * coords — that one moves with the map. This component complements it
 * by keeping a visible roster on the screen at a glance.
 */
/** Six-particle deterministic-jitter spread for the heart burst.
 *  Built statically so each render doesn't re-randomize and React's
 *  reconciler can skip re-creating identical elements. */
const HEART_BURST_PARTICLES = Array.from({ length: 6 }, (_, i) => ({
  // Even-but-not-uniform horizontal spread (-22 to +22px).
  x: (i - 2.5) * 8.5,
  // Stagger the rise so the cluster reads as a soft pulse.
  delay: i * 45,
  // Slight scale variation so the cluster doesn't read as a grid.
  scale: 0.85 + (i % 3) * 0.15,
}));

export default function FloatingUsers() {
  const { users: liveUsers } = useLiveUsers();
  // Tracks which user(s) currently have a hearts burst painting
  // over their floating badge — set on heart click, auto-cleared
  // after the longest particle finishes.
  const [burstingIds, setBurstingIds] = useState<Set<string>>(() => new Set());
  // Tracks which users the viewer has already waved at this
  // session, so a second click un-waves instead of double-firing.
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());

  // Visible-on-map set, published by Globe whenever the viewport
  // moves or the live-users list refreshes. Users whose lat/lng
  // is inside `map.getBounds()` end up in this set, and we
  // filter them OUT of the floating pool — they're already
  // represented as fixed Mapbox markers, so showing the floating
  // counterpart would double-paint them.
  //
  // Per product feedback "Nunca deixar os dois formatos
  // visíveis: flutuante e fixo no mapa. Sempre ou um ou outro.
  // Mostre o flutuante somente quando o fixo estiver fora do
  // alcance de visão do usuário."
  //
  // When Globe is unmounted (mobile routes that drop the map)
  // `globeStore.unregisterMapCallbacks` resets the set to empty,
  // so floating badges show for everyone again until Globe
  // remounts.
  const [visibleOnMap, setVisibleOnMap] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  useEffect(() => {
    const unsub = globeStore.subscribeVisibleUserIds((ids) => {
      setVisibleOnMap(ids);
    });
    return unsub;
  }, []);

  // Floating pool = online users whose lat/lng is OUTSIDE the
  // current map viewport (or who have no coords at all, in which
  // case they can't appear on the map and stay floating forever).
  // The deterministic distribution math runs over this filtered
  // subset so positions reflow as the viewport changes.
  const offMapUsers = useMemo(
    () => liveUsers.filter((u) => !visibleOnMap.has(u.id)),
    [liveUsers, visibleOnMap],
  );
  const pool = useMemo(() => distributeFloatingUsers(offMapUsers), [offMapUsers]);

  /**
   * Heart click on a floating user — mirrors the Globe Mapbox
   * marker flow per product feedback "Deixe o coração visível em
   * todos os boxes de usuários que tem, seja no mapa ou
   * flutuante":
   *   - Track the wave (or un-wave on second click).
   *   - Dispatch the in-app `app:user-waved` custom event so the
   *     rest of the client (toasts, telemetry hooks) reacts.
   *   - Emit `wave:send` over the socket so the SERVER inserts
   *     the notification row + pushes `notify:new` to the
   *     recipient's personal room (the receiver's HeartsCascade
   *     overlay fires from `useNotificationsLive`).
   *   - Spawn a local hearts burst over THIS badge as the
   *     sender's visual confirmation.
   *
   * `stopPropagation` keeps the wrapper-level click (which can
   * flyTo the user's lat/lng on the globe) from also firing.
   */
  const handleWave = (
    user: FloatingUser,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();
    const wasLiked = likedIds.has(user.id);

    if (wasLiked) {
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
      track('user_unwaved', {
        target_user_id: user.id,
        source: 'floating_user',
      });
      return;
    }

    setLikedIds((prev) => new Set(prev).add(user.id));
    setBurstingIds((prev) => new Set(prev).add(user.id));
    window.setTimeout(() => {
      setBurstingIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }, 1800);

    track('user_waved', {
      target_user_id: user.id,
      target_user_name: user.name,
      source: 'floating_user',
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('app:user-waved', {
          detail: { userId: user.id, name: user.name },
        }),
      );
    }

    try {
      const s = getSocket();
      s.emit('wave:send', { targetUserId: user.id });
    } catch (err) {
      console.error('wave:send emit failed:', err);
    }
  };

  return (
    <>
      {pool.map((user) => {
        return (
          <div
            key={user.id}
            className={`${styles.wrapper} ${user.center ? styles.wrapperClickable : ''}`}
            style={{
              left: user.left,
              top: user.top,
              ['--float-dur' as string]: `${user.floatDuration}s`,
              ['--float-del' as string]: `${user.floatDelay}s`,
            } as React.CSSProperties}
            onClick={() => user.center && globeStore.flyTo(user.center, user.zoom ?? 10)}
          >
            <div className={`${styles.badge} ${styles.visible}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={user.img} alt={user.name} className={styles.avatar} />
              <div className={styles.info}>
                <span className={styles.name}>{user.name}</span>
                {user.song ? (
                  <span className={styles.song}>{user.song}</span>
                ) : (
                  <span className={styles.song}>online</span>
                )}
                {/* Hover-expanded detail rows — city + full
                    artist info. Lives INSIDE the badge so the
                    whole pill stays as a single element when it
                    expands, per product feedback "refaça para
                    que seja um único elemento apenas adicionando
                    as informações de Cidade e info completas
                    do nome da música e Artista". CSS controls
                    the collapse via max-height + opacity, driven
                    by `.wrapper:hover` so no React state is
                    needed to toggle these. */}
                <div className={styles.expandedDetails} aria-hidden="true">
                  <div className={styles.detailRow}>
                    <svg
                      className={styles.detailIcon}
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 1a3.5 3.5 0 00-3.5 3.5C2.5 7.5 6 11 6 11s3.5-3.5 3.5-6.5A3.5 3.5 0 006 1z" />
                      <circle cx="6" cy="4.5" r="1" />
                    </svg>
                    <span className={styles.detailText}>
                      {user.city}
                    </span>
                  </div>
                  {user.song && (
                    <div className={styles.detailRow}>
                      <svg
                        className={styles.detailIcon}
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 1v7" />
                        <path d="M5 3v7" />
                        <circle cx="3.5" cy="10" r="1.5" />
                        <circle cx="7.5" cy="8" r="1.5" />
                        <path d="M5 3l4-2" />
                      </svg>
                      <span className={styles.detailText}>
                        {user.song}
                        {user.artist ? ` · ${user.artist}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {/* Always-visible heart — wave affordance per
                  product feedback "Deixe o coração visível em
                  todos os boxes de usuários que tem, seja no
                  mapa ou flutuante". Sits at the right edge of
                  the badge; the click is stopPropagation'd so
                  the badge's own flyTo handler doesn't fire on
                  the same tap. */}
              <button
                type="button"
                className={`${styles.likeBtn} ${likedIds.has(user.id) ? styles.liked : ''}`}
                onClick={(e) => handleWave(user, e)}
                aria-label={
                  likedIds.has(user.id)
                    ? `Você acenou para ${user.name}`
                    : `Acenar para ${user.name}`
                }
                aria-pressed={likedIds.has(user.id)}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill={likedIds.has(user.id) ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
            </div>

            {/* Local hearts-burst overlay anchored on this badge.
                Mirrors the Globe Mapbox marker burst so both
                surfaces feel like a single interaction language.
                Each particle reads CSS custom properties for its
                horizontal jitter / delay / scale so a static
                set of 6 elements still reads as organic. */}
            {burstingIds.has(user.id) && (
              <div className={styles.heartsBurst} aria-hidden="true">
                {HEART_BURST_PARTICLES.map((p, i) => (
                  <div
                    key={i}
                    className={styles.heartParticle}
                    style={
                      {
                        ['--fh-x' as string]: `${p.x}px`,
                        ['--fh-scale' as string]: `${p.scale}`,
                        animationDelay: `${p.delay}ms`,
                      } as React.CSSProperties
                    }
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="#ef4444"
                      aria-hidden="true"
                    >
                      <path d="M12 21s-7-4.35-9.5-9.5C1 8 3.5 4.5 7 4.5c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 3.5 0 6 3.5 4.5 7-2.5 5.15-9.5 9.5-9.5 9.5z" />
                    </svg>
                  </div>
                ))}
              </div>
            )}

            {/* The separate hover-preview card that used to
                render here was retired — its content (city +
                song + artist) now lives inline inside the
                badge above via `.expandedDetails`, so the
                whole element is a single pill that morphs on
                hover. */}
          </div>
        );
      })}
    </>
  );
}
