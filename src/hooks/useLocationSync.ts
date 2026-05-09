'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import type { ApiLocation } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';

const STORAGE_KEY = 'muusic:location:askedAt';

/**
 * Asks the browser for geolocation, sends it to /api/me/location once.
 * Call from the AppPage so the user sees the OS permission prompt only
 * after they're logged in. The backend snaps the coords to a city centroid
 * with deterministic per-user jitter — exact GPS is never persisted.
 */
export function useLocationSync(): {
  status: 'idle' | 'requesting' | 'denied' | 'unavailable' | 'synced' | 'error';
  location: ApiLocation | null;
  request: () => void;
} {
  const { user, refresh } = useAuth();
  const [status, setStatus] = useState<
    'idle' | 'requesting' | 'denied' | 'unavailable' | 'synced' | 'error'
  >('idle');
  const [location, setLocation] = useState<ApiLocation | null>(null);

  const request = useCallback(() => {
    if (!user) return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }

    setStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await api.post<ApiLocation>('/api/me/location', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setLocation(res);
          setStatus('synced');
          // Refresh the auth user so .city / .lat / .lng come along.
          await refresh();
        } catch (err) {
          console.error('location sync failed:', err);
          setStatus(err instanceof ApiError && err.status === 422 ? 'unavailable' : 'error');
        }
      },
      (err) => {
        console.warn('geolocation error:', err);
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {
      // localStorage may be blocked (private mode); ignore.
    }
  }, [user, refresh]);

  // First-login auto-prompt: only if user.city is null (never set) and we
  // haven't asked recently (within 24h). Avoids re-prompting on every page.
  useEffect(() => {
    if (!user) return;
    if (user.city) {
      setLocation({
        city: user.city,
        country: user.country,
        countryCode: user.countryCode,
        lat: user.lat ?? 0,
        lng: user.lng ?? 0,
      });
      setStatus('synced');
      return;
    }

    let lastAsked = 0;
    try {
      lastAsked = parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10);
    } catch {
      // ignore
    }
    const recentlyAsked = Date.now() - lastAsked < 24 * 60 * 60 * 1000;
    if (recentlyAsked) return;

    request();
  }, [user, request]);

  return { status, location, request };
}
