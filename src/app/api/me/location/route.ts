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
  /** True quando o usuário acabou de TOCAR "Compartilhar localização"
   *  (LocateButton / onboarding) — o ato afirmativo concede o
   *  consentimento LGPD. Sem isso, um usuário não-consentido não pode
   *  gravar localização. */
  grantConsent: z.boolean().optional(),
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

  // Menores nunca compartilham localização (LGPD). Defesa em
  // profundidade: o toggle já fica escondido/forçado-off no cliente.
  if (user.isMinor) {
    return NextResponse.json({ error: 'minor_not_allowed' }, { status: 403 });
  }

  // Sem consentimento prévio e sem o ato de concessão explícito → no-op.
  // Mata o auto-sync silencioso pra quem nunca optou por compartilhar.
  if (!user.locationConsent && parsed.grantConsent !== true) {
    return NextResponse.json(
      { error: 'location_consent_required' },
      { status: 403 },
    );
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
      // O tap em "Compartilhar" grava coords E concede consentimento no
      // mesmo write (atômico). Re-sync de quem já consentiu não mexe no flag.
      ...(parsed.grantConsent === true ? { locationConsent: true } : {}),
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
