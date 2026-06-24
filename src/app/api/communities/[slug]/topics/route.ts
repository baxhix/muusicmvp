import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { getCurrentUser } from '@/server/auth/session';
import {
  createTopic,
  listTopics,
} from '@/server/communities/queries';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 *   GET  /api/communities/:slug/topics?search=foo&before=ISO
 *     → paginated topics list, newest first. Anonymous viewers can
 *       read.
 *
 *   POST /api/communities/:slug/topics  body: { title, body? }
 *     → creates a topic. Author MUST be a community member
 *       (server enforces; the UI should also gate the CTA).
 */
const querySchema = z.object({
  search: z.string().nullish(),
  before: z.string().datetime().nullish(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const postSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(4000).nullish(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  // Anonymous viewers can read the topics list — same as the
  // communities list. Doesn't expose any membership-specific data.
  await getCurrentUser();
  const { slug } = await ctx.params;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    search: url.searchParams.get('search'),
    before: url.searchParams.get('before'),
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  try {
    const page = await listTopics({
      slug,
      search: parsed.data.search ?? null,
      before: parsed.data.before ? new Date(parsed.data.before) : null,
      limit: parsed.data.limit,
    });
    return NextResponse.json(page);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'list_failed';
    const status = code === 'not_found' ? 404 : 500;
    if (status === 500)
      logger.error('communities.slug.topics.get-apicommunitiesslugtopics', err)
    return NextResponse.json({ error: code }, { status });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  /* Menor de idade não escreve em comunidades (criar tópico). */
  if (auth.isMinor) {
    return NextResponse.json({ error: 'minor_blocked' }, { status: 403 });
  }
  const { slug } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const res = await createTopic({
      slug,
      authorId: auth.id,
      title: parsed.data.title,
      body: parsed.data.body ?? null,
    });
    return NextResponse.json(res, { status: 201 });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'create_failed';
    const status =
      code === 'not_found'
        ? 404
        : code === 'not_a_member'
          ? 403
          : code === 'title_empty' || code === 'title_too_long'
            ? 400
            : 500;
    if (status === 500)
      logger.error('communities.slug.topics.post-apicommunitiesslugtopics', err)
    return NextResponse.json({ error: code }, { status });
  }
}
