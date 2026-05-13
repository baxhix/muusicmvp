'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiNotification } from '@/lib/api/types';
import { useNotificationsLive } from './useNotificationsLive';

export interface SameTrackToastPayload {
  id: string;
  sourceUserId: string;
  sourceName: string | null;
  sourceEmail: string | null;
  sourceAvatarUrl: string | null;
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  trackYoutubeId: string;
}

interface QueueItem extends SameTrackToastPayload {
  enteredAt: number;
}

const HOLD_MS = 6000;

/**
 * Drives the floating SameTrackToast queue.
 *
 * Implementation note: rather than listening to the raw `notify:new`
 * socket event (whose payload shape changed across versions and may be
 * incomplete when the socket container is older than the web container),
 * we piggy-back on `useNotificationsLive`. That hook already refetches
 * /api/notifications on every notify:new poke and the response is
 * hydrated with sourceUser + track via JOINs.
 *
 * The first list snapshot after mount is treated as 'historical' — we
 * don't toast notifications that already existed when the user landed
 * on the page. Anything that appears later becomes a toast for HOLD_MS.
 */
/**
 * Anything older than this many ms BEFORE the page mounted counts as
 * "historical" and never toasts. 5s of clock-skew slack covers
 * differences between server and client time without letting truly
 * old notifications leak through.
 */
const HISTORICAL_GRACE_MS = 5_000;

export function useSameTrackToasts(): {
  toasts: QueueItem[];
  dismiss: (id: string) => void;
} {
  const { notifications, loading } = useNotificationsLive();
  const [toasts, setToasts] = useState<QueueItem[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const baselineSetRef = useRef(false);
  // Records the page-mount time minus a small grace window. Anything
  // with a server createdAt older than this cutoff is definitionally
  // historical — we never toast it. This is the authoritative guard,
  // working alongside the baseline-set flag below as defense in depth.
  const mountCutoffRef = useRef(Date.now() - HISTORICAL_GRACE_MS);

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    // Wait until the initial fetch from /api/notifications completes
    // before deciding which ids are "historical". Without this guard,
    // the first effect run sees the React state's initial value (an
    // empty array), flips the baseline flag, and then the populated
    // list that arrives milliseconds later gets treated as new arrivals.
    if (loading) return;

    if (!baselineSetRef.current) {
      // Snapshot everything currently known as already-seen so a
      // subsequent same-payload refetch doesn't re-fire each row.
      for (const n of notifications) seenIdsRef.current.add(n.id);
      baselineSetRef.current = true;
      return;
    }

    for (const n of notifications) {
      if (seenIdsRef.current.has(n.id)) continue;
      seenIdsRef.current.add(n.id);

      if (n.kind !== 'same_track') continue;
      if (n.readAt) continue;

      // Authoritative guard: only toast events that were CREATED on
      // the server after the page mounted (with a 5s grace for clock
      // skew). A historical notification refetched mid-session — for
      // any reason — gets silently skipped. The baseline check above
      // handles the initial fetch path; this check handles every
      // other path (socket reconnect replays, race conditions, etc.).
      const createdAtMs = n.createdAt
        ? new Date(n.createdAt).getTime()
        : Number.POSITIVE_INFINITY;
      if (createdAtMs < mountCutoffRef.current) continue;

      const item = buildToast(n);
      setToasts((cur) => {
        if (cur.some((t) => t.id === item.id)) return cur;
        return [...cur, item];
      });

      // Auto-dismiss after HOLD_MS.
      setTimeout(() => {
        setToasts((cur) => cur.filter((t) => t.id !== item.id));
      }, HOLD_MS);
    }
  }, [notifications, loading]);

  return { toasts, dismiss };
}

function buildToast(n: ApiNotification): QueueItem {
  return {
    id: n.id,
    sourceUserId: n.sourceUser?.id ?? n.sourceUserId ?? '',
    sourceName: n.sourceUser?.name ?? null,
    sourceEmail: n.sourceUser?.email ?? null,
    sourceAvatarUrl: n.sourceUser?.avatarUrl ?? null,
    trackId: n.track?.id ?? n.trackId ?? '',
    trackTitle: n.track?.title ?? 'a mesma música',
    trackArtist: n.track?.artist ?? '',
    trackYoutubeId: n.track?.youtubeId ?? '',
    enteredAt: Date.now(),
  };
}
