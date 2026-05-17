'use client';

import { useEffect, useRef } from 'react';
import { api, ApiError } from '@/lib/api/client';
import type { ApiRankingRow } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from './useUserProfile';

/**
 * Watches the viewer's Fanpoints balance for crossings of every
 * 100-multiple and dispatches `app:milestone-fp` so the
 * MilestoneNotification component can pop a celebratory banner
 * at the top of /app.
 *
 * Implementation:
 *  • Captures a baseline `profile.fanpoints` value as soon as the
 *    profile fetch resolves.
 *  • Subscribes to the `app:points-awarded` CustomEvent that
 *    `awardPoints()` (src/lib/rewards.ts) fires for every
 *    engagement reward. Adds the amount to an internal `delta`
 *    counter — never re-reads the profile, so the milestone
 *    detection is reactive even when `useUserProfile` is fetched
 *    once and never re-polled.
 *  • Whenever `floor(baseline + newDelta) / 100` jumps a step,
 *    fires the event. The notification component handles the
 *    visual side; this hook is purely a watcher.
 *  • On the milestone, makes ONE `/api/ranking` call to figure
 *    out whether the user just sits inside the top 10. The result
 *    rides along in the event payload so the banner can append
 *    the "TOP 10!" line conditionally. Failures fall back to
 *    top10: false (the +100 line still shows).
 *
 * Mount this once at the page level (see /app/page.tsx). Multiple
 * mounts would multiply the events; one is enough since the
 * baseline + delta state are component-local refs.
 */
export function useFanpointMilestones() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  /** First fanpoints value we saw — anchors all milestone math. */
  const baselineRef = useRef<number | null>(null);
  /** Sum of all `app:points-awarded` amounts since baseline. */
  const deltaRef = useRef(0);

  // Capture the baseline once the profile hydrates. The check
  // against `null` makes this idempotent — a profile refresh
  // doesn't reset the baseline (which would skip milestones that
  // happen mid-session).
  useEffect(() => {
    if (baselineRef.current === null && profile?.fanpoints != null) {
      baselineRef.current = profile.fanpoints;
    }
  }, [profile?.fanpoints]);

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent<{ amount: number }>).detail;
      if (!detail || typeof detail.amount !== 'number') return;
      const baseline = baselineRef.current;
      if (baseline === null) return;

      const prevTotal = baseline + deltaRef.current;
      deltaRef.current += detail.amount;
      const newTotal = baseline + deltaRef.current;

      // 100-multiple crossing? floor(prev/100) → floor(new/100)
      // strictly increases means at least one 100-boundary was
      // crossed. Even multiple boundaries in one tick collapse
      // into a single notification (rare in practice).
      if (Math.floor(newTotal / 100) <= Math.floor(prevTotal / 100)) return;

      // Check the ranking once to decide if the TOP 10 line
      // should ride along. Wrapped in a try so a network blip
      // never blocks the +100 banner.
      let top10 = false;
      try {
        const res = await api.get<{ ranking: ApiRankingRow[] }>('/api/ranking');
        const myIdx = res.ranking.findIndex((r) => r.userId === user?.id);
        top10 = myIdx >= 0 && myIdx < 10;
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 401) {
          console.error('milestones ranking fetch failed:', err);
        }
      }

      window.dispatchEvent(
        new CustomEvent('app:milestone-fp', {
          detail: { total: newTotal, top10 },
        }),
      );
    };
    window.addEventListener('app:points-awarded', handler);
    return () => window.removeEventListener('app:points-awarded', handler);
  }, [user?.id]);
}
