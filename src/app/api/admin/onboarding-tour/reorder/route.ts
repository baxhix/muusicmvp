import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { reorderOnboardingCards } from '@/server/admin/onboardingTour';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * POST /api/admin/onboarding-tour/reorder
 *
 * Body: { ids: string[] } — lista COMPLETA dos ids na ordem desejada.
 * Grava sortOrder 0,1,2… num único UPDATE transacional.
 */
const schema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    await reorderOnboardingCards(parsed.data.ids);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('admin.onboardingTour.reorder', err);
    return NextResponse.json({ error: 'reorder_failed' }, { status: 500 });
  }
}
