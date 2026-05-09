'use client';

import { useEffect, useState } from 'react';
import {
  getCurrentlyPlaying,
  isSpotifyConnected,
  type SpotifyTrack,
} from '@/lib/spotify';

const POLL_INTERVAL_MS = 15_000; // 15s — respeita rate-limit do Spotify

interface UseSpotifyNowPlayingResult {
  track: SpotifyTrack | null;
  connected: boolean;
  loading: boolean;
}

/**
 * Polling do endpoint `currently-playing` enquanto o usuário tem token válido.
 * Retorna `track: null` se não houver nada tocando ou se o usuário não estiver
 * conectado — daí o consumidor pode cair no fallback (mock SONGS).
 */
export function useSpotifyNowPlaying(): UseSpotifyNowPlayingResult {
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      const isConn = isSpotifyConnected();
      if (!alive) return;
      setConnected(isConn);

      if (!isConn) {
        setTrack(null);
        setLoading(false);
        return;
      }

      try {
        const data = await getCurrentlyPlaying();
        if (!alive) return;
        setTrack(data);
      } catch {
        if (!alive) return;
        setTrack(null);
      } finally {
        if (alive) setLoading(false);
      }

      if (alive) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    tick();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { track, connected, loading };
}
