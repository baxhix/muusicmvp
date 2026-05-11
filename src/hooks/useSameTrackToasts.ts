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
export function useSameTrackToasts(): {
  toasts: QueueItem[];
  dismiss: (id: string) => void;
} {
  const { notifications } = useNotificationsLive();
  const [toasts, setToasts] = useState<QueueItem[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const firstSnapshotRef = useRef(true);

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (firstSnapshotRef.current) {
      // Mark everything in the very first list snapshot as "already seen"
      // so we don't toast every existing notification on page load.
      for (const n of notifications) seenIdsRef.current.add(n.id);
      firstSnapshotRef.current = false;
      return;
    }

    for (const n of notifications) {
      if (seenIdsRef.current.has(n.id)) continue;
      seenIdsRef.current.add(n.id);

      if (n.kind !== 'same_track') continue;
      if (n.readAt) continue;

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
  }, [notifications]);

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
