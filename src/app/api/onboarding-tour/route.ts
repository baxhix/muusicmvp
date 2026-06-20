import { NextResponse } from 'next/server';
import { listPublishedOnboardingCards } from '@/server/admin/onboardingTour';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * GET /api/onboarding-tour
 *
 * Endpoint PÚBLICO (sem auth) — consumido pelo `OnboardingTour` do
 * /app pra montar o deck a partir dos cards publicados no admin.
 * Retorna os passos já no formato `OnboardingTourStep`. O cliente
 * usa o `DEFAULT_ONBOARDING_TOUR` como fallback se a lista vier
 * vazia ou a requisição falhar.
 */
export async function GET() {
  try {
    const cards = await listPublishedOnboardingCards();
    const steps = cards.map((c) => ({
      id: c.id,
      emoji: c.emoji ?? undefined,
      title: c.title,
      body: c.body,
      cta: c.cta,
      decor: c.decor === 'globe' ? ('globe' as const) : undefined,
      anchor: c.anchor ?? undefined,
    }));
    return NextResponse.json({ steps });
  } catch (err) {
    logger.error('public.onboardingTour.get', err);
    return NextResponse.json({ error: 'get_failed' }, { status: 500 });
  }
}
