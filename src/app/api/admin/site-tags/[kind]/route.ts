import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { isSiteTagKind, upsertSiteTag } from '@/server/admin/tags';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * PATCH /api/admin/site-tags/:kind — upsert one tag row. Body:
 *   { value: string, enabled: boolean }
 *
 * Value is trimmed and capped at 200 chars (enough for any pixel
 * ID known today — GA4 is 12 chars, GTM ~10, FB pixel up to 16).
 *
 * PATCH (not PUT) because the admin's shared api client only
 * exposes get/post/patch/delete. Semantically still an upsert.
 */
const bodySchema = z.object({
  value: z.string().max(200),
  enabled: z.boolean(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  const { kind } = await params;
  if (!isSiteTagKind(kind)) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
  }

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
    await upsertSiteTag(
      { kind, value: parsed.data.value, enabled: parsed.data.enabled },
      admin.id,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'save_failed';
    const status = code === 'value_too_long' || code === 'invalid_kind' ? 400 : 500;
    if (status === 500) logger.error('admin.site-tags.kind.upsertsitetag', err)
    return NextResponse.json({ error: code }, { status });
  }
}
