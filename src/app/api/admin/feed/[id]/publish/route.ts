import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { publishFeedPostNow } from '@/server/feed/admin';
import { handleApiError, NotFoundError } from '@/server/api/errors';

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
    // publishFeedPostNow lança Error('post_not_found') quando o id
    // não existe — converte pro tipo padronizado pra 404.
    if (err instanceof Error && err.message === 'post_not_found') {
      return handleApiError(new NotFoundError('post_not_found'), {
        scope: 'admin.feed.publish',
        ctx: { id },
      });
    }
    return handleApiError(err, {
      scope: 'admin.feed.publish',
      ctx: { id },
    });
  }
}
