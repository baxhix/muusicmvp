/** Shared reference to the Mapbox flyTo function, set by Globe on map load. */
type FlyToFn = (center: [number, number], zoom: number) => void;
type SetUserLocationFn = (coords: { lat: number; lng: number } | null) => void;

let _flyTo: FlyToFn | null = null;
let _setUserLocation: SetUserLocationFn | null = null;

export const globeStore = {
  register: (fn: FlyToFn) => { _flyTo = fn; },
  flyTo:    (center: [number, number], zoom: number) => { _flyTo?.(center, zoom); },

  /** Globe registra um handler que cria/atualiza o marker e dá flyTo. */
  registerUserLocation: (fn: SetUserLocationFn) => { _setUserLocation = fn; },
  setUserLocation: (coords: { lat: number; lng: number } | null) => { _setUserLocation?.(coords); },
};
