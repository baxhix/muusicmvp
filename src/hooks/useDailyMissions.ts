'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthContext';

export type DailyMissionId =
  | 'listen_5'
  | 'like_track'
  | 'start_chat'
  | 'daily_login'
  /* Per product feedback "deixe 6 missões no total". Estes 2
   * ainda são display-only (sem tracking real no backend); o hook
   * devolve done=false por default pra IDs que o servidor não
   * conhece, então mostra como pendente sem quebrar nada. */
  | 'share_song'
  | 'follow_artist';

export interface DailyMission {
  id: DailyMissionId;
  progress: number;
  target: number;
  done: boolean;
}

/**
 * Pulls the current user's daily missions from /api/me/missions.
 *
 * Refetches:
 *   - On mount.
 *   - Every 60 seconds while the component is alive (covers slow
 *     drips like "listened to one more track" without needing a
 *     socket push).
 *   - Whenever `refresh()` is called manually — useful right after
 *     the user takes a missionable action (sent a message, liked a
 *     track, etc.) so the chip flips done before the next poll.
 */
export function useDailyMissions(): {
  missions: DailyMission[] | null;
  loading: boolean;
  refresh: () => void;
} {
  const { user } = useAuth();
  const [missions, setMissions] = useState<DailyMission[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!user) {
      setMissions(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<{ missions: DailyMission[] }>('/api/me/missions')
      .then((res) => {
        if (!cancelled) setMissions(res.missions);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('useDailyMissions fetch failed:', err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, tick]);

  // 60s polling fallback. Stops cleanly on unmount.
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [user]);

  return { missions, loading, refresh };
}
