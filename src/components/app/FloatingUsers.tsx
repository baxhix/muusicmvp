'use client';

import { useMemo, useState } from 'react';
import { globeStore } from '@/lib/globeStore';
import { useLiveUsers } from '@/hooks/useLiveUsers';
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
      img: user.avatarUrl ?? `https://i.pravatar.cc/72?u=${user.id}`,
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
export default function FloatingUsers() {
  const { users: liveUsers } = useLiveUsers();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const pool = useMemo(() => distributeFloatingUsers(liveUsers), [liveUsers]);

  return (
    <>
      {pool.map((user) => {
        const isHovered = hoveredId === user.id;
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
            onMouseEnter={() => setHoveredId(user.id)}
            onMouseLeave={() => setHoveredId(null)}
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
              </div>
            </div>

            {isHovered && (
              <div className={styles.preview}>
                <div className={styles.previewTop}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={user.img} alt={user.name} className={styles.previewAvatar} />
                  <div className={styles.previewMeta}>
                    <div className={styles.previewNameRow}>
                      <span className={styles.previewName}>{user.name}</span>
                    </div>
                    <span className={styles.previewCity}>
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 1a3.5 3.5 0 00-3.5 3.5C2.5 7.5 6 11 6 11s3.5-3.5 3.5-6.5A3.5 3.5 0 006 1z" />
                        <circle cx="6" cy="4.5" r="1" />
                      </svg>
                      {user.city}
                    </span>
                  </div>
                </div>
                {user.song && (
                  <>
                    <div className={styles.previewDivider} />
                    <div className={styles.previewSongRow}>
                      <svg className={styles.previewMusicIcon} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 1v7" />
                        <path d="M5 3v7" />
                        <circle cx="3.5" cy="10" r="1.5" />
                        <circle cx="7.5" cy="8" r="1.5" />
                        <path d="M5 3l4-2" />
                      </svg>
                      <div className={styles.previewSongInfo}>
                        <span className={styles.previewSongTitle}>{user.song}</span>
                        <span className={styles.previewArtist}>{user.artist ?? ''}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
