/**
 * Globe camera persistence — survives /app route navigations on
 * mobile where the Globe component fully unmounts to free GPU.
 *
 * Stored in localStorage so the experience picks up exactly where
 * the user left off across sessions too: zoom level, center
 * coords, bearing, pitch. Reads gracefully degrade to the Globe
 * component's defaults if nothing's stored (first visit, cleared
 * data, parse failure).
 *
 * Not a React hook — just plain functions called from the
 * imperative Mapbox initialization inside `Globe.tsx`.
 */

const STORAGE_KEY = 'muusic.globeCamera.v1';

export interface GlobeCameraState {
  lng: number;
  lat: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

export function loadGlobeCamera(): GlobeCameraState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GlobeCameraState>;
    if (
      typeof parsed.lng !== 'number' ||
      typeof parsed.lat !== 'number' ||
      typeof parsed.zoom !== 'number'
    ) {
      return null;
    }
    return {
      lng: parsed.lng,
      lat: parsed.lat,
      zoom: parsed.zoom,
      bearing: parsed.bearing ?? 0,
      pitch: parsed.pitch ?? 0,
    };
  } catch {
    // Corrupted JSON in storage — silent fallback to defaults.
    return null;
  }
}

export function saveGlobeCamera(state: GlobeCameraState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / private mode — survival mode, just skip persistence.
  }
}
