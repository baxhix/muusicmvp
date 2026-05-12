'use client';

import { useEffect, useState } from 'react';
import { useSocket } from './useSocket';

/**
 * Achievement events ride two parallel channels:
 *   - me:achievement  — only the earning user sees this (confetti).
 *   - social:achievement — broadcast to everyone (toast).
 *
 * Today both carry the same point-milestone kind. The shape is open
 * so future kinds (Superfã, Top 3, etc.) can land without a hook
 * rewrite.
 */
export interface MyAchievement {
  kind: 'points_milestone';
  points: number;
  total: number;
  createdAt: string;
  /** Local identifier so multiple celebrations can stack without dedup pain. */
  _localId: string;
}

export interface SocialAchievement {
  kind: 'points_milestone';
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userAvatarUrl: string | null;
  points: number;
  createdAt: string;
  _localId: string;
}

const SOCIAL_TOAST_MS = 4500;
const SELF_CELEBRATION_MS = 7000;

/**
 * Hook used by AchievementCelebration + SocialAchievementToast. Keeps
 * two short queues of recent events; each entry auto-evicts after its
 * own lifetime so consumers can render with a simple `.map(...)`.
 */
export function useAchievements(): {
  myAchievements: MyAchievement[];
  socialAchievements: SocialAchievement[];
} {
  const { socket } = useSocket();
  const [myAchievements, setMyAchievements] = useState<MyAchievement[]>([]);
  const [socialAchievements, setSocialAchievements] = useState<SocialAchievement[]>([]);

  useEffect(() => {
    if (!socket) return;

    const onMine = (raw: unknown) => {
      const p = raw as Partial<MyAchievement> | null;
      if (!p || p.kind !== 'points_milestone') return;
      if (typeof p.points !== 'number') return;
      const item: MyAchievement = {
        kind: 'points_milestone',
        points: p.points,
        total: typeof p.total === 'number' ? p.total : p.points,
        createdAt: p.createdAt ?? new Date().toISOString(),
        _localId: `mine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
      setMyAchievements((prev) => [...prev, item]);
      window.setTimeout(() => {
        setMyAchievements((prev) => prev.filter((a) => a._localId !== item._localId));
      }, SELF_CELEBRATION_MS);
    };

    const onSocial = (raw: unknown) => {
      const p = raw as Partial<SocialAchievement> | null;
      if (!p || p.kind !== 'points_milestone' || !p.userId) return;
      if (typeof p.points !== 'number') return;
      const item: SocialAchievement = {
        kind: 'points_milestone',
        userId: p.userId,
        userName: p.userName ?? null,
        userEmail: p.userEmail ?? null,
        userAvatarUrl: p.userAvatarUrl ?? null,
        points: p.points,
        createdAt: p.createdAt ?? new Date().toISOString(),
        _localId: `social-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
      setSocialAchievements((prev) => [...prev.slice(-3), item]);
      window.setTimeout(() => {
        setSocialAchievements((prev) =>
          prev.filter((a) => a._localId !== item._localId),
        );
      }, SOCIAL_TOAST_MS);
    };

    socket.on('me:achievement', onMine);
    socket.on('social:achievement', onSocial);
    return () => {
      socket.off('me:achievement', onMine);
      socket.off('social:achievement', onSocial);
    };
  }, [socket]);

  return { myAchievements, socialAchievements };
}
