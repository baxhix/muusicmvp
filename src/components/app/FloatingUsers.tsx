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

/** Stable hash → 0..1 floats. Same user always lands on same screen position. */
function hashFloats(seed: string, count: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = Math.imul(h ^ (h >>> 13), 16777619);
    out.push(((h >>> 0) % 100000) / 100000);
  }
  return out;
}

/** ApiOnlineUser → FloatingUser shape with deterministic screen position. */
function projectToFloating(u: ApiOnlineUser): FloatingUser {
  const [x, y, dur, del] = hashFloats(u.id, 4);
  // Keep away from screen edges so the badge doesn't clip
  const left = `${10 + x * 76}%`;
  const top = `${12 + y * 64}%`;
  return {
    id: u.id,
    name: u.name ?? 'Anônimo',
    city: [u.city, u.country].filter(Boolean).join(', ') || '—',
    song: u.nowPlaying?.title ?? null,
    artist: u.nowPlaying?.artist ?? null,
    img: u.avatarUrl ?? `https://i.pravatar.cc/72?u=${u.id}`,
    left,
    top,
    floatDuration: 3.5 + dur * 1.8,
    floatDelay: -del * 4,
    center: u.lng != null && u.lat != null ? [u.lng, u.lat] : undefined,
    zoom: 10,
  };
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

  const pool = useMemo(() => liveUsers.map(projectToFloating), [liveUsers]);

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
