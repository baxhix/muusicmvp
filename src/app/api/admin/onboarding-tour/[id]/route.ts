import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  deleteOnboardingCard,
  getOnboardingCard,
  updateOnboardingCard,
} from '@/server/admin/onboardingTour';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** GET /api/admin/onboarding-tour/:id — card específico. 404 se não existe. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    const entry = await getOnboardingCard(id);
    if (!entry) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ entry });
  } catch (err) {
    logger.error('admin.onboardingTour.get', err);
    return NextResponse.json({ error: 'get_failed' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/onboarding-tour/:id
 * Body: { emoji?, title?, body?, cta?, decor?, anchor?, publish? }
 */
const updateSchema = z.object({
  emoji: z.string().max(16).nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(2_000).optional(),
  cta: z.string().min(1).max(40).optional(),
  decor: z.enum(['globe']).nullable().optional(),
  anchor: z.string().max(60).nullable().optional(),
  publish: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const entry = await updateOnboardingCard(id, parsed.data, admin.id);
    if (!entry) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ entry });
  } catch (err) {
    logger.error('admin.onboardingTour.update', err);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
}

/** DELETE /api/admin/onboarding-tour/:id — hard delete (sem deps). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    const ok = await deleteOnboardingCard(id);
    if (!ok) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('admin.onboardingTour.delete', err);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}
