'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSocket } from './useSocket';

const TICK_MS = 10_000; // emit a tick every 10s while playing

/**
 * Track what the user is listening to. Emits `listening:tick` over the
 * socket every 10s with { youtubeId, positionSeconds, isPaused }, so the
 * server can update `now_playing` + `listening_history` and trigger
 * "same track" notifications.
 *
 * Call from the player component with the current track + state.
 *
 * On track change, fires immediately so the server records the new track
 * without waiting up to 10s for the next tick.
 *
 * On unmount or `youtubeId === null`, sends `listening:stop` to clear
 * the user's now-playing row.
 */
export function useListeningTracker(input: {
  youtubeId: string | null;
  positionSeconds: number;
  isPaused: boolean;
}) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const lastTrackRef = useRef<string | null>(null);
  const lastTickRef = useRef(0);

  useEffect(() => {
    if (!user || !socket || !connected) return;

    const { youtubeId, positionSeconds, isPaused } = input;

    // No track → tell the server to clear the row.
    if (!youtubeId) {
      if (lastTrackRef.current !== null) {
        socket.emit('listening:stop');
        lastTrackRef.current = null;
        lastTickRef.current = 0;
      }
      return;
    }

    const trackChanged = lastTrackRef.current !== youtubeId;
    const now = Date.now();
    const dueForTick = now - lastTickRef.current >= TICK_MS;

    if (trackChanged || dueForTick) {
      socket.emit('listening:tick', {
        youtubeId,
        positionSeconds: Math.max(0, Math.floor(positionSeconds)),
        isPaused,
      });
      lastTrackRef.current = youtubeId;
      lastTickRef.current = now;
    }
  }, [user, socket, connected, input]);

  // Periodic ticking even if the player props don't change for >10s
  // (e.g. video keeps playing without re-rendering).
  useEffect(() => {
    if (!user || !socket || !connected) return;
    const id = setInterval(() => {
      const yid = lastTrackRef.current;
      if (!yid) return;
      socket.emit('listening:tick', {
        youtubeId: yid,
        positionSeconds: Math.max(0, Math.floor(input.positionSeconds)),
        isPaused: input.isPaused,
      });
      lastTickRef.current = Date.now();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [user, socket, connected, input.positionSeconds, input.isPaused]);

  // Final cleanup on unmount.
  useEffect(() => {
    return () => {
      if (socket && lastTrackRef.current) {
        socket.emit('listening:stop');
        lastTrackRef.current = null;
      }
    };
  }, [socket]);
}
