'use client';

/* ============================================================
 * MAP SIMULATION — barrel export + hook compartilhado.
 *
 * `useSimulationData()` gera os 3.000 mock users uma única vez
 * (memoizado) e retorna geojson pronto pro Mapbox + stats por
 * cidade pro HUD. Custo de geração: ~15-25ms em devices
 * intermediários — chamado lazy só quando o flag está on.
 *
 * NUNCA tocar real backend. NUNCA persistir. Dataset existe
 * apenas no objeto retornado pelo hook.
 * ============================================================ */

import { useMemo } from 'react';
import { generateMockUsers, aggregateByCity, type MockUser, type CityStats } from './generator';

export type { MockUser, CityStats } from './generator';
export type { Tier } from './generator';
export { generateMockUsers, aggregateByCity } from './generator';
export { CITY_SEEDS, REGION_TOTALS, TOTAL_USERS } from './cities';
export type { Region, CitySeed } from './cities';

export interface SimulationData {
  users: MockUser[];
  geojson: GeoJSON.FeatureCollection<GeoJSON.Point, MockUserProps>;
  cities: CityStats[];
  total: number;
  activeNow: number;
}

export interface MockUserProps {
  id: string;
  name: string;
  tier: 'superfan' | 'top100' | 'top1000' | 'fan';
  /** Weight pra heatmap: 2× pra ativos (<5min), 1× pros demais. */
  weight: number;
  lastActiveSec: number;
  city: string;
  avatarSeed: number;
}

let _cache: SimulationData | null = null;

/** Gera (ou retorna do cache) o dataset completo da simulação. */
export function getSimulationData(): SimulationData {
  if (_cache) return _cache;
  const users = generateMockUsers();
  const features: GeoJSON.Feature<GeoJSON.Point, MockUserProps>[] = users.map((u) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [u.lng, u.lat] },
    properties: {
      id: u.id,
      name: u.name,
      tier: u.tier,
      weight: u.lastActiveSec < 300 ? 2 : 1,
      lastActiveSec: u.lastActiveSec,
      city: u.city,
      avatarSeed: u.avatarSeed,
    },
  }));
  const cities = aggregateByCity(users);
  const activeNow = users.filter((u) => u.lastActiveSec < 300).length;
  _cache = {
    users,
    geojson: { type: 'FeatureCollection', features },
    cities,
    total: users.length,
    activeNow,
  };
  return _cache;
}

/** Hook React — usa lazy initialization pra cachear globally. */
export function useSimulationData(): SimulationData {
  return useMemo(getSimulationData, []);
}
