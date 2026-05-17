import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { getCurrentUser } from '@/server/auth/session';
import {
  createCommunity,
  listCommunities,
} from '@/server/communities/queries';

export const runtime = 'nodejs';

/**
 *   GET /api/communities?search=foo&limit=30
 *     → paginated list of communities. Anonymous viewers get the
 *       list too (isMember always false). Search is case-insensitive
 *       against name + description.
 *
 *   POST /api/communities  body: { name, description?, imageUrl? }
 *     → creates a community. Requires the viewer to have ≥10k FP;
 *       the creator is auto-joined as the first member.
 */

const querySchema = z.object({
  search: z.string().nullish(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const postSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullish(),
  imageUrl: z.string().max(500).nullish(),
});

export async function GET(req: Request) {
  // Anonymous viewers can browse the list — isMember just stays
  // false for every row in that case. We sidestep `requireUser`
  // (which 401s when there's no session) and read the optional
  // user via `getCurrentUser` directly.
  const viewer = await getCurrentUser();
  const viewerId = viewer?.id ?? null;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    search: url.searchParams.get('search'),
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  try {
    const page = await listCommunities({
      viewerId,
      search: parsed.data.search ?? null,
      limit: parsed.data.limit,
    });
    return NextResponse.json(page);
  } catch (err) {
    console.error('GET /api/communities failed:', err);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

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
    const res = await createCommunity({
      creatorId: auth.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
    });
    return NextResponse.json(res, { status: 201 });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'create_failed';
    const status =
      code === 'insufficient_fanpoints'
        ? 403
        : code === 'name_empty' || code === 'name_too_long'
          ? 400
          : 500;
    if (status === 500) console.error('POST /api/communities failed:', err);
    return NextResponse.json({ error: code }, { status });
  }
}
