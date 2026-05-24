import { describe, it, expect } from 'vitest';
import { jitterCoords } from './jitter';

const SP: [number, number] = [-46.6333, -23.5505]; // São Paulo centroid

/**
 * Distância grosseira em km entre dois pontos (lat/lng) usando aproximação plana.
 * Suficiente pra raio de poucos km — o jitter usa o mesmo modelo.
 */
function distKm([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const dLat = (lat2 - lat1) * 111;
  const dLng = (lng2 - lng1) * 111 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

describe('jitterCoords — determinismo (privacy)', () => {
  it('mesmo seed → mesmo ponto (estável entre reloads)', () => {
    const a = jitterCoords(SP, 'user-1:sao-paulo');
    const b = jitterCoords(SP, 'user-1:sao-paulo');
    expect(a).toEqual(b);
  });

  it('seeds diferentes → pontos diferentes (sem cluster no centroid)', () => {
    const a = jitterCoords(SP, 'user-1:sao-paulo');
    const b = jitterCoords(SP, 'user-2:sao-paulo');
    expect(a).not.toEqual(b);
  });

  it('mesmo user em cidades diferentes cai em pontos diferentes', () => {
    const a = jitterCoords(SP, 'user-1:sao-paulo');
    const b = jitterCoords(SP, 'user-1:rio-de-janeiro');
    expect(a).not.toEqual(b);
  });
});

describe('jitterCoords — confinamento (privacy)', () => {
  it('ponto fica dentro do radiusKm informado (default 4km)', () => {
    for (let i = 0; i < 100; i++) {
      const p = jitterCoords(SP, `user-${i}:sao-paulo`);
      const d = distKm(SP, p);
      expect(d).toBeLessThanOrEqual(4.01); // tolerância numérica
    }
  });

  it('radiusKm custom é respeitado', () => {
    for (let i = 0; i < 100; i++) {
      const p = jitterCoords(SP, `user-${i}:sp`, 10);
      const d = distKm(SP, p);
      expect(d).toBeLessThanOrEqual(10.01);
    }
  });

  it('radiusKm pequeno (1km) também confina', () => {
    for (let i = 0; i < 50; i++) {
      const p = jitterCoords(SP, `u${i}`, 1);
      const d = distKm(SP, p);
      expect(d).toBeLessThanOrEqual(1.01);
    }
  });
});

describe('jitterCoords — distribuição (anti-clustering)', () => {
  it('pontos não colapsam todos no centroid', () => {
    const points: Array<[number, number]> = [];
    for (let i = 0; i < 100; i++) {
      points.push(jitterCoords(SP, `user-${i}:sp`));
    }
    // Pelo menos 90% dos pontos têm distância > 0.1km do centroid.
    const farFromCenter = points.filter((p) => distKm(SP, p) > 0.1).length;
    expect(farFromCenter).toBeGreaterThan(90);
  });

  it('sqrt(u2) gera distribuição uniforme sobre área do disco', () => {
    // Em distribuição uniforme em disco, ~75% dos pontos devem estar
    // além de metade do raio (área externa é 3/4 da área total).
    const samples = 500;
    const radius = 4;
    let beyondHalf = 0;
    for (let i = 0; i < samples; i++) {
      const p = jitterCoords(SP, `dist-test-${i}`, radius);
      if (distKm(SP, p) > radius / 2) beyondHalf++;
    }
    const ratio = beyondHalf / samples;
    // Esperado ~0.75, aceito 0.65–0.85 pra ruído amostral
    expect(ratio).toBeGreaterThan(0.65);
    expect(ratio).toBeLessThan(0.85);
  });

  it('ângulos cobrem todos os quadrantes', () => {
    const quadrants = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const [lng, lat] = jitterCoords(SP, `quad-${i}`);
      const dx = lng - SP[0];
      const dy = lat - SP[1];
      const q = (dx >= 0 ? 0 : 2) + (dy >= 0 ? 0 : 1);
      quadrants.add(q);
    }
    expect(quadrants.size).toBe(4); // todos os 4 quadrantes
  });
});

describe('jitterCoords — segurança', () => {
  it('coords nunca são iguais ao centroid exato (não vaza GPS real)', () => {
    for (let i = 0; i < 100; i++) {
      const p = jitterCoords(SP, `noleak-${i}`);
      expect(p[0]).not.toBe(SP[0]);
      expect(p[1]).not.toBe(SP[1]);
    }
  });

  it('seed vazio também produz ponto válido (não crasha)', () => {
    const p = jitterCoords(SP, '');
    expect(p).toHaveLength(2);
    expect(Number.isFinite(p[0])).toBe(true);
    expect(Number.isFinite(p[1])).toBe(true);
  });

  it('seed com chars especiais é tratado como bytes (SHA-256)', () => {
    const a = jitterCoords(SP, 'foo:bar:baz');
    const b = jitterCoords(SP, 'foo%3Abar%3Abaz');
    // Strings diferentes em bytes → hashes diferentes → pontos diferentes
    expect(a).not.toEqual(b);
  });
});
