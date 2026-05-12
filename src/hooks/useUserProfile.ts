'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type { ApiUserProfile } from '@/lib/api/types';

/**
 * Fetches a user's public profile by id. Pass null to skip the fetch
 * (useful when the consumer toggles between "show own profile" — read
 * straight from useAuth — and "show this other user's profile").
 *
 * Returns { profile, loading, error }; `profile` stays null until the
 * fetch resolves, then mirrors the API shape directly so the panel
 * doesn't need a per-render mapping.
 */
export function useUserProfile(id: string | null): {
  profile: ApiUserProfile | null;
  loading: boolean;
  error: string | null;
} {
  const [profile, setProfile] = useState<ApiUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setProfile(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<{ user: ApiUserProfile }>(`/api/users/${id}/profile`)
      .then((res) => {
        if (!cancelled) setProfile(res.user);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('useUserProfile fetch failed:', err);
        setError(err instanceof Error ? err.message : 'fetch_failed');
        setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { profile, loading, error };
}
