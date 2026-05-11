/** Shared reference to the Mapbox flyTo function, set by Globe on map load. */
type FlyToFn = (center: [number, number], zoom: number) => void;

export interface UserLocationPayload {
  coords: { lat: number; lng: number };
  avatarUrl?: string | null;
  /** Label rendered next to the avatar (e.g. "Você"). */
  name?: string | null;
}

export interface LiveMapUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  lat: number;
  lng: number;
  /** Optional now-playing track for the hover/preview UI. */
  trackTitle?: string | null;
  trackArtist?: string | null;
}

type SetUserLocationFn = (payload: UserLocationPayload | null) => void;
type SetLiveUsersFn = (users: LiveMapUser[]) => void;

let _flyTo: FlyToFn | null = null;
let _setUserLocation: SetUserLocationFn | null = null;
let _setLiveUsers: SetLiveUsersFn | null = null;
let _liveUsersBuffer: LiveMapUser[] | null = null;

export const globeStore = {
  register: (fn: FlyToFn) => { _flyTo = fn; },
  flyTo:    (center: [number, number], zoom: number) => { _flyTo?.(center, zoom); },

  /** Globe registra um handler que cria/atualiza o marker do user logado. */
  registerUserLocation: (fn: SetUserLocationFn) => { _setUserLocation = fn; },
  setUserLocation: (payload: UserLocationPayload | null) => { _setUserLocation?.(payload); },

  /**
   * Globe registers a handler that syncs markers for OTHER online users.
   * Buffers the last set so callers can publish before the map finishes
   * loading — the buffer is flushed on the first register call.
   */
  registerLiveUsers: (fn: SetLiveUsersFn) => {
    _setLiveUsers = fn;
    if (_liveUsersBuffer) {
      fn(_liveUsersBuffer);
      _liveUsersBuffer = null;
    }
  },
  setLiveUsers: (users: LiveMapUser[]) => {
    if (_setLiveUsers) _setLiveUsers(users);
    else _liveUsersBuffer = users;
  },
};
