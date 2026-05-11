/** Shared reference to the Mapbox flyTo function, set by Globe on map load. */
type FlyToFn = (center: [number, number], zoom: number) => void;

export interface UserLocationPayload {
  coords: { lat: number; lng: number };
  avatarUrl?: string | null;
  /** Label rendered next to the avatar (e.g. "Você"). */
  name?: string | null;
}

type SetUserLocationFn = (payload: UserLocationPayload | null) => void;

let _flyTo: FlyToFn | null = null;
let _setUserLocation: SetUserLocationFn | null = null;

export const globeStore = {
  register: (fn: FlyToFn) => { _flyTo = fn; },
  flyTo:    (center: [number, number], zoom: number) => { _flyTo?.(center, zoom); },

  /** Globe registra um handler que cria/atualiza o marker do user logado. */
  registerUserLocation: (fn: SetUserLocationFn) => { _setUserLocation = fn; },
  setUserLocation: (payload: UserLocationPayload | null) => { _setUserLocation?.(payload); },
};
