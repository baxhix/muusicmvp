'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { TRACKS_CATALOG, type CatalogTrack } from '@/data/tracksCatalog';

/**
 * Live tracks catalog. The static `TRACKS_CATALOG` (from
 * src/data/tracksCatalog.ts) is the initial value so the player has
 * content immediately even before /api/tracks resolves — no flicker,
 * no "loading…" state in the UI. Once the API responds, the in-memory
 * list is replaced with the DB-backed one, which includes anything an
 * admin added via /api/admin/tracks.
 *
 * Auth required (same gate the rest of /api uses), so the hook
 * effectively becomes a no-op for logged-out callers — but the
 * static fallback still works.
 */
export function useTracksCatalog(): { tracks: CatalogTrack[] } {
  const [tracks, setTracks] = useState<CatalogTrack[]>(TRACKS_CATALOG);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ tracks: CatalogTrack[] }>('/api/tracks')
      .then((res) => {
        if (!cancelled && Array.isArray(res.tracks) && res.tracks.length > 0) {
          setTracks(res.tracks);
        }
      })
      .catch((err) => {
        // Don't downgrade the player to "no songs" on a transient
        // failure — silently keep the static seed in place.
        if (!cancelled) console.error('useTracksCatalog fetch failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { tracks };
}
