import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getReferralStats } from '@/server/referral/queries';

export const runtime = 'nodejs';

/**
 * GET /api/me/referral
 *
 * Retorna o painel de referral do usuário logado:
 *   { code, url, invited, activated, pointsEarned, rewardPerFriend }
 *
 * Garante (lazy) que o usuário tenha um referral_code. Usado pelo
 * modal "Convide amigos" no app.
 */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const stats = await getReferralStats(user.id);
  return NextResponse.json(stats);
}
