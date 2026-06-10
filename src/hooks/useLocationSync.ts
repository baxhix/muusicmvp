'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import type { ApiLocation } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';

/**
 * Asks the browser for geolocation, sends it to /api/me/location once.
 * Call from the AppPage so the user sees the OS permission prompt only
 * after they're logged in. The backend snaps the coords to a city centroid
 * with deterministic per-user jitter — exact GPS is never persisted.
 */
export function useLocationSync(): {
  status: 'idle' | 'requesting' | 'denied' | 'unavailable' | 'synced' | 'error';
  location: ApiLocation | null;
  request: (opts?: { grant?: boolean }) => void;
} {
  const { user, refresh } = useAuth();
  const [status, setStatus] = useState<
    'idle' | 'requesting' | 'denied' | 'unavailable' | 'synced' | 'error'
  >('idle');
  const [location, setLocation] = useState<ApiLocation | null>(null);

  // `grant: true` é passado pelo CTA manual (LocateButton) — o tap concede
  // o consentimento LGPD junto com a captura. O auto-sync chama sem grant
  // (e só roda pra quem JÁ consentiu — ver o guard no effect abaixo).
  const request = useCallback(
    (opts?: { grant?: boolean }) => {
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
              ...(opts?.grant ? { grantConsent: true } : {}),
            });
            setLocation(res);
            setStatus('synced');
            // Refresh the auth user so .city / .lat / .lng come along.
            await refresh();
          } catch (err) {
            console.error('location sync failed:', err);
            setStatus(
              err instanceof ApiError && err.status === 422
                ? 'unavailable'
                : 'error',
            );
          }
        },
        (err) => {
          console.warn('geolocation error:', err);
          setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
      );
    },
    [user, refresh],
  );

  // Tenta a captura de recuperação no máximo uma vez por mount (ver effect).
  const autoSyncedRef = useRef(false);

  // Reflete coords já capturadas + recupera quem consentiu mas está sem
  // coords. A VISIBILIDADE no mapa exige coords não-nulas (listOnlineUsers),
  // então o gate é coords presentes — não só `city`.
  useEffect(() => {
    if (!user) return;

    // Já tem coords → reflete como synced (sem recaptura). Só popula
    // `location` quando há `city` (ApiLocation.city é não-nulável); o
    // sinal de "synced" depende só das coords.
    if (user.lat != null && user.lng != null) {
      setLocation(
        user.city != null
          ? {
              city: user.city,
              country: user.country,
              countryCode: user.countryCode,
              lat: user.lat,
              lng: user.lng,
            }
          : null,
      );
      setStatus('synced');
      return;
    }

    // Daqui pra baixo: SEM coords.
    // LGPD: quem não consentiu nunca é auto-promptado — precisa do CTA
    // manual (LocateButton, grant:true). Este é o gate de privacidade real.
    if (!user.locationConsent) return;

    // Consentiu mas está sem coords — ex.: legado da revogação que apagava
    // a localização, ou consentiu (toggle) mas nunca capturou. A captura é
    // o que efetivamente coloca o usuário no mapa, então tentamos UMA vez
    // por mount: silenciosa se a permissão do navegador já foi concedida,
    // um prompt se estiver "perguntar", falha calada se "negada". Sem isso
    // o toggle fica ON e o usuário nunca aparece pros outros.
    if (autoSyncedRef.current) return;
    autoSyncedRef.current = true;
    request();
  }, [user, request]);

  return { status, location, request };
}
