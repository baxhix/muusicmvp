/** Shared reference to the Mapbox flyTo function, set by Globe on map load. */
type FlyToFn = (center: [number, number], zoom: number) => void;

export interface UserLocationPayload {
  coords: { lat: number; lng: number };
  avatarUrl?: string | null;
  /** Label rendered next to the avatar (e.g. "Você"). */
  name?: string | null;
  /** Current track playing — when set, the badge shows the title and an
   *  animated audio-bars indicator. */
  trackTitle?: string | null;
  trackArtist?: string | null;
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

/**
 * One asset in an Ana Castela check-in. The map pin's modal renders
 * an inline gallery of these in order. Videos auto-play muted on
 * open (the standard "stories" treatment) and are tappable to
 * unmute — exactly the same affordance the feed video posts use.
 */
export interface AnaCheckInMedia {
  type: 'image' | 'video';
  url: string;
  /** Optional poster (video thumbnail). Falls back to first frame. */
  poster?: string | null;
  alt?: string | null;
}

/**
 * One full Ana check-in event. Spawned by the scheduler in /app
 * page (or by a backend endpoint when we wire one up). `startedAt`
 * is when the pin appeared on the map; the modal converts that to
 * "há X minutos" relative time. The pin's deterministic id keeps
 * the marker stable across re-renders triggered by track-change
 * refreshes elsewhere on the map.
 */
export interface AnaCheckInPayload {
  id: string;
  city: string;
  state: string;
  lng: number;
  lat: number;
  caption?: string | null;
  media: AnaCheckInMedia[];
  startedAt: string;
}

/**
 * One upcoming Ana show — a calendar entry that drops a small
 * pin on the globe with the date chip baked into the marker. The
 * pin is click-only: the user taps it to reveal a popover with
 * the venue / city / "Ingressos" CTA. The CTA itself has no real
 * link yet (the spec calls for a "sem ação" button) — when ticket
 * partners ship, `ticketUrl` carries the URL the CTA opens.
 */
export interface AnaShow {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Long venue name shown inside the popover. */
  venue: string;
  city: string;
  state: string;
  lng: number;
  lat: number;
  /** Future-proofing — CTA stays inert until this is set. */
  ticketUrl?: string | null;
}

/**
 * Tour Portugal — Ana's transatlantic flight from Londrina (BR)
 * to Lisbon (PT). The payload carries enough geometry for the
 * Globe to paint the two line segments + the airplane marker
 * without needing to recompute great-circle math itself; the
 * spherical interpolation lives in `lib/anaFlight.ts`.
 */
export interface AnaFlightPayload {
  /** 0–1 progress along the path. */
  progress: number;
  /** True once the plane has reached Lisbon. */
  arrived: boolean;
  /** Plane's current lng/lat. */
  position: { lng: number; lat: number };
  /** Compass bearing in degrees (0=N) — used to rotate the
   *  airplane SVG so its nose follows the path. */
  bearingDeg: number;
  /** Pre-sampled great-circle polyline as [lng, lat] pairs. The
   *  source-of-truth for the line layers; the two segments below
   *  are slices of this array. */
  traveledPath: ReadonlyArray<readonly [number, number]>;
  remainingPath: ReadonlyArray<readonly [number, number]>;
  /** Hours left until Lisbon — rendered in the modal label. */
  hoursRemaining: number;
}

type SetUserLocationFn = (payload: UserLocationPayload | null) => void;
type SetLiveUsersFn = (users: LiveMapUser[]) => void;
type SetTotalRegisteredFn = (total: number) => void;
type OpenUserProfileFn = (userId: string) => void;
type SetAnaCheckInFn = (payload: AnaCheckInPayload | null) => void;
type OpenAnaCheckInFn = (payload: AnaCheckInPayload) => void;
type SetAnaShowsFn = (shows: AnaShow[]) => void;
type SetAnaFlightFn = (payload: AnaFlightPayload | null) => void;
type OpenAnaFlightFn = (payload: AnaFlightPayload) => void;

let _flyTo: FlyToFn | null = null;
let _setUserLocation: SetUserLocationFn | null = null;
let _setLiveUsers: SetLiveUsersFn | null = null;
let _liveUsersBuffer: LiveMapUser[] | null = null;
let _setTotalRegistered: SetTotalRegisteredFn | null = null;
let _totalRegisteredBuffer: number | null = null;
let _openUserProfile: OpenUserProfileFn | null = null;
let _setAnaCheckIn: SetAnaCheckInFn | null = null;
let _anaCheckInBuffer: AnaCheckInPayload | null = null;
let _openAnaCheckIn: OpenAnaCheckInFn | null = null;
let _setAnaShows: SetAnaShowsFn | null = null;
let _anaShowsBuffer: AnaShow[] | null = null;
let _setAnaFlight: SetAnaFlightFn | null = null;
let _anaFlightBuffer: AnaFlightPayload | null = null;
let _openAnaFlight: OpenAnaFlightFn | null = null;

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

  /**
   * Globe registers a handler that scatters ambient "fan presence"
   * dots whose COUNT reflects the platform's total registered users.
   * Buffered the same way live users are — caller may publish before
   * the map style finishes loading.
   */
  registerTotalRegistered: (fn: SetTotalRegisteredFn) => {
    _setTotalRegistered = fn;
    if (_totalRegisteredBuffer !== null) {
      fn(_totalRegisteredBuffer);
      _totalRegisteredBuffer = null;
    }
  },
  setTotalRegistered: (total: number) => {
    if (_setTotalRegistered) _setTotalRegistered(total);
    else _totalRegisteredBuffer = total;
  },

  /**
   * Page registers a handler that opens the ProfilePanel for a given
   * user id. Globe calls openUserProfile(id) when a presence pin is
   * clicked, so the click goes from raw DOM → page state without a
   * direct React dependency.
   */
  registerOpenUserProfile: (fn: OpenUserProfileFn) => { _openUserProfile = fn; },
  openUserProfile: (userId: string) => { _openUserProfile?.(userId); },

  /**
   * Ana Castela check-in pin lifecycle.
   *
   *   setAnaCheckIn(payload)  → Globe creates / updates the marker
   *   setAnaCheckIn(null)     → Globe removes the marker
   *
   * The /app page owns the scheduler (every 2 min by default) and
   * the "linger 60s after the modal closes" timer; this store is
   * just the wire between page → Globe → modal.
   *
   * Like the other setters here, the payload is buffered if Globe
   * registers its handler after the page has already published —
   * keeps the marker visible on a hot remount.
   */
  registerAnaCheckIn: (fn: SetAnaCheckInFn) => {
    _setAnaCheckIn = fn;
    if (_anaCheckInBuffer) {
      fn(_anaCheckInBuffer);
      _anaCheckInBuffer = null;
    }
  },
  setAnaCheckIn: (payload: AnaCheckInPayload | null) => {
    if (_setAnaCheckIn) _setAnaCheckIn(payload);
    else _anaCheckInBuffer = payload;
  },

  /**
   * Globe → page handoff when the pin is tapped. The page registers
   * a handler that opens the AnaCheckInPanel modal with the
   * just-clicked payload.
   */
  registerOpenAnaCheckIn: (fn: OpenAnaCheckInFn) => { _openAnaCheckIn = fn; },
  openAnaCheckIn: (payload: AnaCheckInPayload) => { _openAnaCheckIn?.(payload); },

  /**
   * Upcoming Ana shows — a list of date-pinned markers. Setting an
   * empty array clears every show pin. Buffered the same way as
   * the other registries so the page can publish before Globe's
   * map load fires.
   *
   * The popover that opens when a pin is tapped lives INSIDE the
   * marker DOM (no React modal), so the page doesn't need an
   * `openAnaShow` symmetry like check-ins have. The shows are
   * read-only marker UI today.
   */
  registerAnaShows: (fn: SetAnaShowsFn) => {
    _setAnaShows = fn;
    if (_anaShowsBuffer) {
      fn(_anaShowsBuffer);
      _anaShowsBuffer = null;
    }
  },
  setAnaShows: (shows: AnaShow[]) => {
    if (_setAnaShows) _setAnaShows(shows);
    else _anaShowsBuffer = shows;
  },

  /**
   * Ana Castela Tour Portugal flight lifecycle.
   *
   *   setAnaFlight(payload) → Globe paints (or updates) the two
   *                            line segments + airplane marker.
   *   setAnaFlight(null)    → Globe removes the flight overlay
   *                            entirely (used when the tour ends).
   *
   * Buffered like the other registries so the scheduler in the
   * shell provider can publish before Globe's map load completes.
   */
  registerAnaFlight: (fn: SetAnaFlightFn) => {
    _setAnaFlight = fn;
    if (_anaFlightBuffer) {
      fn(_anaFlightBuffer);
      _anaFlightBuffer = null;
    }
  },
  setAnaFlight: (payload: AnaFlightPayload | null) => {
    if (_setAnaFlight) _setAnaFlight(payload);
    else _anaFlightBuffer = payload;
  },

  /**
   * Globe → page handoff when the airplane marker is tapped. The
   * page registers a handler that opens the AnaFlightPanel modal
   * ("Tour Portugal" + message input).
   */
  registerOpenAnaFlight: (fn: OpenAnaFlightFn) => { _openAnaFlight = fn; },
  openAnaFlight: (payload: AnaFlightPayload) => { _openAnaFlight?.(payload); },
};
