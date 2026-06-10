/**
 * GET /i/[code] — endpoint público de redirect pra links de
 * convite usuário→usuário (loop viral). Espelha o /r/[slug] de
 * aquisição de artista, mas seta o cookie `fanverse_invite`.
 *
 * Fluxo:
 *   1. Fã compartilha muusic.live/i/ABCD2345 (seu referral_code).
 *   2. Este handler valida que o code existe (referrer ativo). Se
 *      OK, seta cookie `fanverse_invite={code}` (30 dias).
 *   3. Redirect 302 pra /teste (landing principal).
 *   4. No signup, o backend lê o cookie → cria referral pending +
 *      grava users.referred_by_user_id (recordReferralAttribution).
 *   5. Quando o convidado completa onboarding, o referrer ganha FP.
 *
 * Code inexistente → ainda redireciona (não quebra link), mas sem
 * setar cookie (sem atribuição).
 */

import { NextResponse } from 'next/server';
import { resolveReferralCode } from '@/server/referral/queries';

export const runtime = 'nodejs';

const COOKIE_NAME = 'fanverse_invite';
/* 30 dias — mesmo TTL do cookie de aquisição (`fanverse_ref`). */
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30;

export async function GET(
  req: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const normalized = code.trim().toUpperCase();

  const url = new URL(req.url);
  const dest = new URL('/teste', url.origin);
  const response = NextResponse.redirect(dest, 302);

  try {
    const referrerId = await resolveReferralCode(normalized);
    if (referrerId) {
      response.cookies.set({
        name: COOKIE_NAME,
        value: normalized,
        maxAge: COOKIE_MAX_AGE_S,
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
      });
    }
  } catch {
    /* DB down — segue o redirect sem atribuição. */
  }

  return response;
}
