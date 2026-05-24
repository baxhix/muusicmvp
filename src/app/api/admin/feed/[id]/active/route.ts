import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { setPostActive } from '@/server/feed/admin';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * POST /api/admin/feed/:id/active — flip is_active.
 *   body: { isActive: boolean }
 *
 * Acts as a soft "hide from public feed" toggle that doesn't change
 * the post's lifecycle status (published / scheduled / draft).
 */
const schema = z.object({ isActive: z.boolean() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

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
    const post = await setPostActive(id, parsed.data.isActive);
    return NextResponse.json(post);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'toggle_failed';
    const status = code === 'post_not_found' ? 404 : 500;
    if (status === 500) logger.error('admin.feed.id.active.setpostactive', err)
    return NextResponse.json({ error: code }, { status });
  }
}
