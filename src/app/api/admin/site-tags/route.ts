import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { listAllSiteTags } from '@/server/admin/tags';

export const runtime = 'nodejs';

/**
 * GET /api/admin/site-tags — returns every known tag kind with its
 * current value + enabled flag. Kinds the team hasn't touched come
 * back with `value=''` + `enabled=false` so the admin form has a
 * full grid to render against.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const items = await listAllSiteTags();
  return NextResponse.json({ items });
}
