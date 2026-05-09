'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  requestUserLocation,
  getCachedLocation,
  clearCachedLocation,
  type UserCoords,
} from '@/lib/location';

interface UseUserLocationResult {
  location: UserCoords | null;
  loading: boolean;
  error: string | null;
  request: () => Promise<UserCoords | null>;
  clear: () => void;
}

export function useUserLocation(): UseUserLocationResult {
  const [location, setLocation] = useState<UserCoords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lê o cache (se ainda válido) na primeira render
  useEffect(() => {
    const cached = getCachedLocation();
    if (cached) setLocation(cached);
  }, []);

  const request = useCallback(async (): Promise<UserCoords | null> => {
    setLoading(true);
    setError(null);
    try {
      const coords = await requestUserLocation();
      setLocation(coords);
      return coords;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao buscar localização');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    clearCachedLocation();
    setLocation(null);
  }, []);

  return { location, loading, error, request, clear };
}
