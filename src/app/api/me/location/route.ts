import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { requireUser } from '@/server/auth/requireUser';
import { reverseGeocodeCity } from '@/server/location/mapbox';
import { jitterCoords } from '@/server/location/jitter';

export const runtime = 'nodejs';

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const place = await reverseGeocodeCity(parsed.lat, parsed.lng);
  if (!place) {
    return NextResponse.json({ error: 'no_city_match' }, { status: 422 });
  }

  // Stable per-(user, city) jitter — same user always lands on same point in
  // the same city, but different users in the same city are spread out.
  const seed = `${user.id}:${place.countryCode ?? '??'}:${place.city}`;
  const [jLng, jLat] = jitterCoords(place.centroid, seed, 4);

  await db
    .update(users)
    .set({
      city: place.city,
      country: place.country,
      countryCode: place.countryCode,
      lat: jLat,
      lng: jLng,
    })
    .where(eq(users.id, user.id));

  return NextResponse.json({
    city: place.city,
    country: place.country,
    countryCode: place.countryCode,
    lat: jLat,
    lng: jLng,
  });
}
