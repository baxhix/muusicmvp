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

/**
 * Ponto EXIBIDO no mapa ao vivo: re-embaralha o ponto já aproximado do
 * usuário num raio pequeno, trocando a cada janela de tempo (`bucketMs`).
 *
 * Objetivo: reforçar que a localização é APROXIMADA. Um ponto fixo, mesmo
 * sendo falso, passa a impressão de ser exato; movendo de tempos em tempos
 * fica claro que é uma região, não um endereço.
 *
 * Propriedades:
 *  - NÃO escreve no banco (calculado na leitura) → barato.
 *  - NÃO toca em GPS real (parte do ponto já aproximado salvo) → seguro.
 *  - Determinístico dentro da janela (seed = userId + bucket) → todos que
 *    olham veem o MESMO ponto naquele intervalo; oscila em torno do ponto
 *    salvo (não acumula deriva, não foge da cidade).
 *
 * `nowMs` é injetado pelo chamador (testabilidade). `bucketMs` default 1h.
 */
export function rotatingDisplayPoint(
  stored: [number, number], // [lng, lat] já aproximado (centroid + jitter)
  userId: string,
  nowMs: number,
  bucketMs = 60 * 60 * 1000, // 1h
  radiusKm = 1.5,
): [number, number] {
  const bucket = Math.floor(nowMs / bucketMs);
  return jitterCoords(stored, `${userId}:rot:${bucket}`, radiusKm);
}
