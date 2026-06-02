'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { TRACKS_CATALOG, type CatalogTrack } from '@/data/tracksCatalog';

/**
 * Live tracks catalog. The static `TRACKS_CATALOG` (from
 * src/data/tracksCatalog.ts) é o valor inicial — player tem
 * conteúdo imediatamente sem flicker / "Loading…".
 *
 * Quando /api/tracks responde (logged-in), MERGE static + DB:
 *  - DB tem precedência por youtubeId (qualquer edit que o
 *    admin fez via /api/admin/tracks vence o seed estático)
 *  - Faixas do seed que NÃO existem no DB são anexadas depois
 *
 * Antes substituía o array todo, então faixas novas adicionadas
 * ao seed (ex.: Fire Arena release) sumiam pra usuários logados
 * até alguém rodar o seed script ou popular via admin. O merge
 * elimina esse delay — ship code → faixas no ar.
 *
 * Auth required (mesma gate de /api), então fica no-op pra
 * logged-out callers, mas o fallback estático segue funcionando.
 */
export function useTracksCatalog(): { tracks: CatalogTrack[] } {
  const [tracks, setTracks] = useState<CatalogTrack[]>(TRACKS_CATALOG);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ tracks: CatalogTrack[] }>('/api/tracks')
      .then((res) => {
        if (!cancelled && Array.isArray(res.tracks) && res.tracks.length > 0) {
          const dbIds = new Set(res.tracks.map((t) => t.youtubeId));
          const staticExtras = TRACKS_CATALOG.filter(
            (t) => !dbIds.has(t.youtubeId),
          );
          setTracks([...res.tracks, ...staticExtras]);
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
