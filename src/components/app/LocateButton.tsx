'use client';

import { useEffect } from 'react';
import { useUserLocation } from '@/hooks/useUserLocation';
import { globeStore } from '@/lib/globeStore';
import styles from './LocateButton.module.css';

export default function LocateButton() {
  const { location, loading, error, request } = useUserLocation();

  // Sempre que `location` mudar, propaga pro Globe (cria marker + flyTo)
  useEffect(() => {
    if (location) {
      globeStore.setUserLocation({ lat: location.lat, lng: location.lng });
    }
  }, [location]);

  const handleClick = async () => {
    const coords = await request();
    if (coords) {
      globeStore.flyTo([coords.lng, coords.lat], 11);
    }
  };

  return (
    <button
      type="button"
      className={`${styles.btn} ${location ? styles.btnActive : ''}`}
      onClick={handleClick}
      disabled={loading}
      aria-label="Mostrar minha localização no mapa"
      title={
        error
          ? error
          : location
            ? 'Centralizar no meu local'
            : 'Mostrar minha localização'
      }
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
