import { NextResponse } from 'next/server';
import { getTopic } from '@/server/communities/queries';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * GET /api/communities/:slug/topics/:topicId
 *   → topic detail (title, body, author, commentCount).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; topicId: string }> },
) {
  const { topicId } = await ctx.params;
  try {
    const topic = await getTopic({ topicId });
    if (!topic) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ topic });
  } catch (err) {
    logger.error('communities.slug.topics.topicId.get-topic', err)
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
