/* ============================================================
 * ANA CASTELA FLIGHT — Tour Portugal
 *
 * Animates a plane along a great-circle path from Londrina (BR)
 * to Lisbon (PT). The path renders as TWO line segments on the
 * globe:
 *
 *   - "Traveled" segment (pink)   — origin → current position
 *   - "Remaining" segment (gray)  — current position → destination
 *
 * Plus an airplane marker that sits at the current position.
 * Tapping the plane opens the AnaFlightPanel ("Tour Portugal"
 * + message input).
 *
 * Progress is wall-clock driven so every viewer sees the same
 * state at the same moment — no per-user storage needed. The
 * full 8-hour journey, plus a short "at destination" pause,
 * forms one cycle that loops perpetually. This keeps the demo
 * lively without requiring a backend timestamp to tick over.
 *
 * To anchor the flight to a real departure (e.g. once the tour
 * actually lands a real schedule), replace `getFlightState()`'s
 * cycle math with: `(Date.now() - DEPARTURE_MS) / DURATION_MS`.
 * Every other piece (line interpolation, marker rotation, panel
 * wiring) is independent of how progress is computed.
 * ============================================================ */

/** Geographic endpoints — kept exported so the panel can label
 *  them in the UI without re-importing constants. */
export const LONDRINA = {
  name: 'Londrina',
  state: 'PR',
  lat: -23.3045,
  lng: -51.1696,
} as const;

export const LISBON = {
  name: 'Lisboa',
  state: 'PT',
  lat: 38.7223,
  lng: -9.1393,
} as const;

/** 8h flight; spec calls for an hourly progress refresh. */
export const FLIGHT_DURATION_MS = 8 * 60 * 60 * 1000;

/** After arrival, the plane sits at Lisbon for this long before
 *  the demo restarts another 8h journey. Keeps the marker on
 *  screen continuously so viewers always have something to look
 *  at, no matter when they open the app. */
const POST_ARRIVAL_PAUSE_MS = 4 * 60 * 60 * 1000;

const CYCLE_MS = FLIGHT_DURATION_MS + POST_ARRIVAL_PAUSE_MS;

/** Number of intermediate points along the great-circle path.
 *  64 is dense enough to read as a smooth arc at every zoom
 *  level we expose without making the GeoJSON unnecessarily
 *  chunky. */
const PATH_SAMPLES = 64;

export interface LngLat {
  readonly lng: number;
  readonly lat: number;
}

export interface FlightState {
  /** 0–1, how far along the path the plane currently sits. */
  readonly progress: number;
  /** Whether the plane has reached Lisbon and is in the "at
   *  destination" portion of the cycle. The line stops moving
   *  here but the plane marker stays parked at Lisbon. */
  readonly arrived: boolean;
  /** Plane's current lng/lat (great-circle interpolation). */
  readonly position: LngLat;
  /** Compass bearing in degrees (0 = N, 90 = E). Used to rotate
   *  the airplane SVG so its nose points along the path. */
  readonly bearingDeg: number;
  /** Pre-computed full path (origin → destination) as a polyline.
   *  GeoJSON-ready: an array of [lng, lat] pairs. Mapbox layers
   *  slice this into traveled/remaining segments. */
  readonly fullPath: ReadonlyArray<readonly [number, number]>;
  /** Subset of `fullPath` from origin → current position. */
  readonly traveledPath: ReadonlyArray<readonly [number, number]>;
  /** Subset of `fullPath` from current position → destination. */
  readonly remainingPath: ReadonlyArray<readonly [number, number]>;
  /** Hours-remaining label rendered inside the modal — recomputed
   *  off `progress` so it always matches the visual. */
  readonly hoursRemaining: number;
}

/* ── Spherical math ─────────────────────────────────────────────
 *
 * Great-circle interpolation between two lat/lng points uses
 * SLERP on the corresponding unit vectors. Treats Earth as a
 * sphere — the curve error against the WGS-84 ellipsoid is well
 * under 1km over this distance, way below visual resolution at
 * any zoom we surface on the globe. */

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

function toUnitVector(p: LngLat): [number, number, number] {
  const lat = toRad(p.lat);
  const lng = toRad(p.lng);
  return [Math.cos(lat) * Math.cos(lng), Math.cos(lat) * Math.sin(lng), Math.sin(lat)];
}

function fromUnitVector(v: [number, number, number]): LngLat {
  const lat = toDeg(Math.asin(v[2]));
  const lng = toDeg(Math.atan2(v[1], v[0]));
  return { lat, lng };
}

/** SLERP between two unit vectors on a sphere. */
function slerp(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  // Tiny angle → linear interpolation is fine and avoids the
  // sin(0) blow-up in the denominator.
  if (omega < 1e-6) {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
  }
  const sinOmega = Math.sin(omega);
  const s0 = Math.sin((1 - t) * omega) / sinOmega;
  const s1 = Math.sin(t * omega) / sinOmega;
  return [
    a[0] * s0 + b[0] * s1,
    a[1] * s0 + b[1] * s1,
    a[2] * s0 + b[2] * s1,
  ];
}

/** Great-circle point at fraction t (0–1) of the way from a → b. */
function interpolateGreatCircle(a: LngLat, b: LngLat, t: number): LngLat {
  if (t <= 0) return { lng: a.lng, lat: a.lat };
  if (t >= 1) return { lng: b.lng, lat: b.lat };
  return fromUnitVector(slerp(toUnitVector(a), toUnitVector(b), t));
}

/** Initial bearing from p1 to p2 (degrees, 0 = north). */
function bearing(p1: LngLat, p2: LngLat): number {
  const φ1 = toRad(p1.lat);
  const φ2 = toRad(p2.lat);
  const Δλ = toRad(p2.lng - p1.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Pre-compute the full great-circle polyline once at module
 *  load. It never changes — endpoints are fixed. */
const FULL_PATH: ReadonlyArray<readonly [number, number]> = (() => {
  const a = toUnitVector(LONDRINA);
  const b = toUnitVector(LISBON);
  return Array.from({ length: PATH_SAMPLES + 1 }, (_, i) => {
    const t = i / PATH_SAMPLES;
    const v = slerp(a, b, t);
    const { lng, lat } = fromUnitVector(v);
    return [lng, lat] as const;
  });
})();

/** Compute the current flight state from wall-clock time. The
 *  cycle (8h flight + 4h pause) loops perpetually so every viewer
 *  sees a plane somewhere on the path regardless of when they
 *  open the app. */
export function getFlightState(now: number = Date.now()): FlightState {
  const cyclePos = ((now % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
  const arrived = cyclePos >= FLIGHT_DURATION_MS;
  const progress = arrived ? 1 : cyclePos / FLIGHT_DURATION_MS;

  // Current point along the great-circle.
  const position = interpolateGreatCircle(LONDRINA, LISBON, progress);

  // Bearing — point the nose toward Lisbon while en route, freeze
  // at the final bearing once arrived.
  const bearingDeg = arrived
    ? bearing(
        { lat: FULL_PATH[FULL_PATH.length - 2][1], lng: FULL_PATH[FULL_PATH.length - 2][0] },
        LISBON,
      )
    : bearing(position, LISBON);

  // Slice the pre-computed polyline at the index closest to the
  // current progress. We snap to the nearest sample to keep both
  // line segments aligned on a shared vertex (smooth handoff).
  const splitIdx = Math.round(progress * PATH_SAMPLES);
  const traveledPath = FULL_PATH.slice(0, splitIdx + 1);
  const remainingPath = FULL_PATH.slice(splitIdx);

  const hoursRemaining = Math.max(0, 8 * (1 - progress));

  return {
    progress,
    arrived,
    position,
    bearingDeg,
    fullPath: FULL_PATH,
    traveledPath,
    remainingPath,
    hoursRemaining,
  };
}
