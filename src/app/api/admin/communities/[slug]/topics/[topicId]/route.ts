import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  adminHardDeleteTopic,
  adminSoftDeleteTopic,
  adminUpdateTopic,
  getAdminTopic,
} from '@/server/communities/admin';

export const runtime = 'nodejs';

/**
 *   GET    /api/admin/communities/:slug/topics/:topicId
 *   PATCH  /api/admin/communities/:slug/topics/:topicId
 *     body: { title?, body?, deletedAt? } — `deletedAt: null` to restore,
 *           `deletedAt: 'now'` (or `true`) to soft-delete.
 *   DELETE /api/admin/communities/:slug/topics/:topicId?hard=true
 *     Hard delete by default (cascade nukes comments + reactions).
 *     ?hard=false → soft-delete (alias for PATCH deletedAt:'now').
 */

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(4000).nullish(),
  /** undefined = leave alone; null = restore; true = soft-delete. */
  deletedAt: z.union([z.null(), z.literal(true)]).optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ topicId: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { topicId } = await ctx.params;
  const topic = await getAdminTopic(topicId);
  if (!topic) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ topic });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ topicId: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { topicId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    if (parsed.data.title !== undefined || parsed.data.body !== undefined) {
      await adminUpdateTopic({
        topicId,
        title: parsed.data.title,
        body: parsed.data.body,
      });
    }
    if (parsed.data.deletedAt !== undefined) {
      await adminSoftDeleteTopic({
        topicId,
        restore: parsed.data.deletedAt === null,
      });
    }
    const topic = await getAdminTopic(topicId);
    return NextResponse.json({ topic });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'update_failed';
    const status =
      code === 'not_found'
        ? 404
        : code === 'title_empty' || code === 'title_too_long'
          ? 400
          : 500;
    if (status === 500) console.error('admin patch topic failed:', err);
    return NextResponse.json({ error: code }, { status });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ topicId: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { topicId } = await ctx.params;
  const url = new URL(req.url);
  // Default behavior is HARD delete on the explicit DELETE verb.
  // ?hard=false flips it to a soft-delete equivalent.
  const hardFlag = (url.searchParams.get('hard') ?? 'true').toLowerCase();
  const hard = hardFlag !== 'false' && hardFlag !== '0';

  try {
    if (hard) await adminHardDeleteTopic(topicId);
    else await adminSoftDeleteTopic({ topicId, restore: false });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'delete_failed';
    const status = code === 'not_found' ? 404 : 500;
    if (status === 500) console.error('admin delete topic failed:', err);
    return NextResponse.json({ error: code }, { status });
  }
}
