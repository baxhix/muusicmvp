'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSocket } from './useSocket';

export interface SameTrackToastPayload {
  id: string;             // notification id (also used as React key)
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
 * Listens for socket `notify:new` events of kind 'same_track' and exposes a
 * short-lived queue for the floating SameTrackToast component to render.
 * Each toast auto-removes after HOLD_MS. Multiple toasts can coexist (they
 * stack visually).
 */
export function useSameTrackToasts(): {
  toasts: QueueItem[];
  dismiss: (id: string) => void;
} {
  const { socket } = useSocket();
  const [toasts, setToasts] = useState<QueueItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onNew = (raw: unknown) => {
      const payload = raw as Partial<SameTrackToastPayload> & { kind?: string };
      if (payload?.kind !== 'same_track') return;
      // Defensive: bail if the server didn't include the new fields (older builds).
      if (!payload.id || !payload.trackTitle) return;

      const item: QueueItem = {
        id: payload.id,
        sourceUserId: payload.sourceUserId!,
        sourceName: payload.sourceName ?? null,
        sourceEmail: payload.sourceEmail ?? null,
        sourceAvatarUrl: payload.sourceAvatarUrl ?? null,
        trackId: payload.trackId!,
        trackTitle: payload.trackTitle,
        trackArtist: payload.trackArtist ?? '',
        trackYoutubeId: payload.trackYoutubeId ?? '',
        enteredAt: Date.now(),
      };

      setToasts((cur) => {
        // Avoid duplicates if the same socket event arrives twice (reconnect).
        if (cur.some((t) => t.id === item.id)) return cur;
        return [...cur, item];
      });

      // Auto-dismiss after HOLD_MS.
      setTimeout(() => {
        setToasts((cur) => cur.filter((t) => t.id !== item.id));
      }, HOLD_MS);
    };

    socket.on('notify:new', onNew);
    return () => {
      socket.off('notify:new', onNew);
    };
  }, [socket]);

  return { toasts, dismiss };
}
