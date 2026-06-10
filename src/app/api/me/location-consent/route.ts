import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { requireUser } from '@/server/auth/requireUser';

export const runtime = 'nodejs';

const bodySchema = z.object({ consent: z.boolean() });

/**
 * PATCH /api/me/location-consent — concede ou revoga o consentimento
 * LGPD de compartilhamento de localização.
 *
 *   • consent:true  → levanta o gate. NÃO captura coords aqui (isso é o
 *     papel do LocateButton / auto-sync, agora permitidos). Bloqueado
 *     pra menores.
 *   • consent:false → revoga E zera lat/lng/city/country no mesmo write
 *     (mesmo conjunto de campos que o cron de anonimização limpa). O
 *     usuário some do mapa de outros na hora (listOnlineUsers filtra por
 *     coords + location_consent).
 *
 * Os eventos de analytics (location_consent_granted/_revoked) são
 * disparados no cliente, que conhece a `surface`.
 */
export async function PATCH(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (parsed.consent) {
    // Menores nunca compartilham localização (LGPD).
    if (user.isMinor) {
      return NextResponse.json({ error: 'minor_not_allowed' }, { status: 403 });
    }
    await db
      .update(users)
      .set({ locationConsent: true })
      .where(eq(users.id, user.id));
    return NextResponse.json({ locationConsent: true });
  }

  // Revogação: desliga o flag E apaga a localização aproximada.
  await db
    .update(users)
    .set({
      locationConsent: false,
      lat: null,
      lng: null,
      city: null,
      country: null,
      countryCode: null,
    })
    .where(eq(users.id, user.id));
  return NextResponse.json({ locationConsent: false });
}
