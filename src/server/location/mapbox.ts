import { env } from '../env';

export type ReverseGeocodeResult = {
  city: string;
  country: string | null;
  countryCode: string | null;
  centroid: [number, number]; // [lng, lat]
};

/**
 * Reverse-geocode a coordinate to a city using Mapbox.
 * Returns null if Mapbox finds no `place`-level feature (oceans, sparse areas).
 *
 * We deliberately discard the input coordinate and return only the city
 * centroid so the caller can apply per-user jitter (privacy-preserving).
 */
export async function reverseGeocodeCity(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult | null> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`,
  );
  url.searchParams.set('types', 'place');
  url.searchParams.set('limit', '1');
  url.searchParams.set('language', 'pt');
  url.searchParams.set('access_token', env.MAPBOX_TOKEN);

  const res = await fetch(url, {
    // Avoid Next caching this; tokens differ per env and results are PII-adjacent.
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Mapbox geocoding failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as {
    features?: Array<{
      text?: string;
      center?: [number, number];
      context?: Array<{ id: string; text?: string; short_code?: string }>;
    }>;
  };

  const feature = json.features?.[0];
  if (!feature?.text || !feature.center) return null;

  const country = feature.context?.find((c) => c.id.startsWith('country.'));

  return {
    city: feature.text,
    country: country?.text ?? null,
    countryCode: country?.short_code?.toUpperCase() ?? null,
    centroid: feature.center,
  };
}
