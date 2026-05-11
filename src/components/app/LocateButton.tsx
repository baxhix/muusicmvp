'use client';

import { useLocationSync } from '@/hooks/useLocationSync';
import { useAuth } from '@/lib/auth/AuthContext';
import { globeStore } from '@/lib/globeStore';
import styles from './LocateButton.module.css';

/**
 * Top-right floating control that lets the user either:
 *
 *  - Share their location for the first time (or after a previous deny):
 *    triggers the browser geolocation prompt and POSTs the result to
 *    /api/me/location, which is what actually makes the user visible on
 *    other people's maps.
 *
 *  - When already synced: just centers the globe on their (jittered)
 *    city-level coords.
 *
 * The button used to call `useUserLocation` which only updated a local
 * marker — that's why granting location here did NOT make the user
 * appear in `/api/users/online` for others, causing asymmetric
 * visibility. Now it routes through `useLocationSync` so the backend
 * always gets the update.
 */
export default function LocateButton() {
  const { user } = useAuth();
  const { status, request } = useLocationSync();

  const hasCoords = user?.lat != null && user?.lng != null;
  const loading = status === 'requesting';
  const isCallToAction = !hasCoords && !loading;

  const handleClick = () => {
    if (hasCoords && user) {
      globeStore.flyTo([user.lng as number, user.lat as number], 11);
    } else {
      request();
    }
  };

  const title =
    status === 'denied'
      ? 'Permissão negada — habilite a localização nas configurações do navegador.'
      : status === 'unavailable'
        ? 'Não consegui detectar sua localização.'
        : hasCoords
          ? 'Centralizar no meu local'
          : 'Compartilhar localização — assim você aparece no mapa pros outros';

  return (
    <button
      type="button"
      className={`${styles.btn} ${hasCoords ? styles.btnActive : ''} ${isCallToAction ? styles.btnPulse : ''}`}
      onClick={handleClick}
      disabled={loading}
      aria-label={hasCoords ? 'Centralizar no meu local' : 'Compartilhar minha localização'}
      title={title}
    >
      {loading ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={styles.spin}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
          <line x1="12" y1="2"  x2="12" y2="5"  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="2"  y1="12" x2="5"  y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="19" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
