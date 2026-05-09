import crypto from 'node:crypto';

/**
 * Deterministic per-(user, city) random offset within `radiusKm` of the centroid.
 * Same user in same city always lands on the same point (stable across page
 * reloads). Different users in the same city get spread out across the area.
 *
 * Rationale: privacy-preserving (we never store the real GPS coords) and
 * visually pleasing (no clustering at the city centroid like Mapbox returns).
 */
export function jitterCoords(
  centroid: [number, number], // [lng, lat]
  seedKey: string,            // e.g. `${userId}:${cityKey}`
  radiusKm = 4,
): [number, number] {
  const buf = crypto.createHash('sha256').update(seedKey).digest();

  // Two independent uniforms in [0, 1).
  const u1 = buf.readUInt32BE(0) / 0xffffffff;
  const u2 = buf.readUInt32BE(4) / 0xffffffff;

  const angle = u1 * 2 * Math.PI;
  // sqrt() to get uniform distribution over disk area, not biased to center.
  const dist = Math.sqrt(u2) * radiusKm;

  const [lng, lat] = centroid;
  const dLat = dist / 111;                                  // ~111km per degree lat
  const dLng = dist / (111 * Math.cos((lat * Math.PI) / 180));

  return [lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)];
}
