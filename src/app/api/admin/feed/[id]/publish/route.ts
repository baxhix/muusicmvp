import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { publishFeedPostNow } from '@/server/feed/admin';

export const runtime = 'nodejs';

/**
 * POST /api/admin/feed/:id/publish — flip the post to status='published'
 * + stamp publishedAt=now. Idempotent. Used by the "Publicar agora"
 * quick action on the listing row.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const post = await publishFeedPostNow(id);
    return NextResponse.json(post);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'publish_failed';
    const status = code === 'post_not_found' ? 404 : 500;
    if (status === 500) console.error('publishFeedPostNow failed:', err);
    return NextResponse.json({ error: code }, { status });
  }
}
