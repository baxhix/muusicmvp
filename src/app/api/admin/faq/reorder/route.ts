import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { reorderFaqEntries } from '@/server/admin/faq';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * POST /api/admin/faq/reorder
 *
 * Body: { ids: string[] }
 *
 * Recebe a lista COMPLETA dos ids na ordem desejada. O server
 * grava `sortOrder` 0, 1, 2… num único transactional UPDATE.
 * Ver `reorderFaqEntries` em server/admin/faq.ts pra rationale.
 */
const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
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
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    await reorderFaqEntries(parsed.data.ids);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('admin.faq.reorder', err);
    return NextResponse.json({ error: 'reorder_failed' }, { status: 500 });
  }
}
