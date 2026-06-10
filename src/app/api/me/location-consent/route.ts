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
 *   • consent:true  → levanta o gate de visibilidade. As coords já
 *     capturadas (onboarding/LocateButton/auto-sync) reaparecem na hora.
 *     Bloqueado pra menores.
 *   • consent:false → SÓ desliga o flag. As coords aproximadas (nível de
 *     cidade, já com jitter) ficam GUARDADAS, porém escondidas: o usuário
 *     some do mapa de outros na hora porque listOnlineUsers filtra por
 *     location_consent e o redactLocation zera os campos cross-user.
 *     Religar mostra de novo instantaneamente, sem recapturar localização.
 *     Erasure de fato fica pra exclusão de conta / anonimização.
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

  // Revogação: SÓ desliga o flag de visibilidade. As coords aproximadas
  // ficam guardadas mas escondidas (listOnlineUsers filtra por
  // location_consent + redactLocation zera cross-user), então nada vaza
  // enquanto OFF e religar mostra o usuário na hora — sem recaptura.
  await db
    .update(users)
    .set({ locationConsent: false })
    .where(eq(users.id, user.id));
  return NextResponse.json({ locationConsent: false });
}
