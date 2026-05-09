'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

const MAX_VISIBLE = 4;

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

function getRandMs(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
}

type Phase = 'hidden' | 'entering' | 'visible' | 'exiting';

export default function FloatingUsers() {
  const { users: liveUsers } = useLiveUsers();

  const pool = useMemo(
    () => liveUsers.map(projectToFloating),
    [liveUsers],
  );

  const [states, setStates] = useState<Record<string, Phase>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const visCount = useRef(0);

  // Schedule entry/exit cycle for one user
  useEffect(() => {
    const ids = pool.map((u) => u.id);
    const idSet = new Set(ids);

    // Cancel timers and remove state for users who left.
    for (const [id, t] of timers.current) {
      if (!idSet.has(id)) {
        clearTimeout(t);
        timers.current.delete(id);
      }
    }
    setStates((prev) => {
      const next: Record<string, Phase> = {};
      for (const id of ids) {
        next[id] = prev[id] ?? 'hidden';
      }
      return next;
    });

    function schedule(id: string, delay?: number) {
      const t = setTimeout(() => {
        if (visCount.current >= MAX_VISIBLE) {
          schedule(id, getRandMs(2, 5));
          return;
        }
        visCount.current++;
        setStates((s) => ({ ...s, [id]: 'entering' }));

        const t2 = setTimeout(() => {
          setStates((s) => ({ ...s, [id]: 'visible' }));
          const t3 = setTimeout(() => {
            setStates((s) => ({ ...s, [id]: 'exiting' }));
            const t4 = setTimeout(() => {
              visCount.current = Math.max(0, visCount.current - 1);
              setStates((s) => ({ ...s, [id]: 'hidden' }));
              schedule(id, getRandMs(3, 9));
            }, 800);
            timers.current.set(id, t4);
          }, getRandMs(6, 14));
          timers.current.set(id, t3);
        }, 900);
        timers.current.set(id, t2);
      }, delay ?? getRandMs(0, 8));
      timers.current.set(id, t);
    }

    // Schedule new users that don't have a timer yet
    for (const id of ids) {
      if (!timers.current.has(id)) {
        schedule(id, getRandMs(0, 10));
      }
    }

    return () => {
      // (intentionally don't clear all on every effect run — only the unmount
      // case below is the full cleanup)
    };
  }, [pool]);

  // Unmount: kill every timer
  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
      visCount.current = 0;
    };
  }, []);

  return (
    <>
      {pool.map((user) => {
        const phase = states[user.id] ?? 'hidden';
        if (phase === 'hidden') return null;
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
            <div className={`${styles.badge} ${styles[phase]}`}>
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
                        <path d="M6 1a3.5 3.5 0 00-3.5 3.5C2.5 7.5 6 11 6 11s3.5-3.5 3.5-6.5A3.5 3.5 0 006 1z"/>
                        <circle cx="6" cy="4.5" r="1"/>
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
                        <path d="M9 1v7"/>
                        <path d="M5 3v7"/>
                        <circle cx="3.5" cy="10" r="1.5"/>
                        <circle cx="7.5" cy="8" r="1.5"/>
                        <path d="M5 3l4-2"/>
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
