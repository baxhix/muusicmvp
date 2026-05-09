/**
 * Geolocalização do navegador via Geolocation API.
 * Cache em localStorage pra não pedir permissão toda vez.
 */

const STORAGE_KEY = 'fanverse:userLocation';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos — depois disso pede de novo

export type UserCoords = { lat: number; lng: number; ts: number };

export class GeolocationDeniedError extends Error {
  constructor() { super('Permissão de localização negada'); this.name = 'GeolocationDeniedError'; }
}
export class GeolocationUnavailableError extends Error {
  constructor() { super('Localização indisponível'); this.name = 'GeolocationUnavailableError'; }
}
export class GeolocationTimeoutError extends Error {
  constructor() { super('Tempo esgotado ao buscar localização'); this.name = 'GeolocationTimeoutError'; }
}

/** Pede a localização atual do usuário. Pode disparar prompt do navegador. */
export function requestUserLocation(): Promise<UserCoords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new GeolocationUnavailableError());
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: UserCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          ts: Date.now(),
        };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(coords)); } catch { /* ignore */ }
        resolve(coords);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED)       reject(new GeolocationDeniedError());
        else if (err.code === err.POSITION_UNAVAILABLE) reject(new GeolocationUnavailableError());
        else                                            reject(new GeolocationTimeoutError());
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    );
  });
}

/** Retorna a última localização salva, se ainda dentro do TTL. */
export function getCachedLocation(): UserCoords | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserCoords;
    if (!parsed?.lat || !parsed?.lng) return null;
    if (Date.now() - (parsed.ts || 0) > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCachedLocation() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
