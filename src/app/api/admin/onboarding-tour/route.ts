import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  createOnboardingCard,
  listOnboardingCards,
} from '@/server/admin/onboardingTour';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * GET /api/admin/onboarding-tour
 *
 * Lista todos os cards (rascunhos + publicados), ordenados por
 * `sortOrder` asc. Caller é o admin UI em /admin/onboarding.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const items = await listOnboardingCards();
    return NextResponse.json({ items });
  } catch (err) {
    logger.error('admin.onboardingTour.list', err);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

/**
 * POST /api/admin/onboarding-tour
 *
 * Body: { emoji?, title, body, cta, decor?, anchor?, publish? }
 * Cria um card no fim da lista (max sortOrder + 1).
 */
const createSchema = z.object({
  emoji: z.string().max(16).nullable().optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2_000),
  cta: z.string().min(1).max(40),
  decor: z.enum(['globe']).nullable().optional(),
  anchor: z.string().max(60).nullable().optional(),
  publish: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const entry = await createOnboardingCard(parsed.data, admin.id);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    logger.error('admin.onboardingTour.create', err);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
}
