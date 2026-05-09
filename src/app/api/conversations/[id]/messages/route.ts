import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { listMessages, userIsInConversation } from '@/server/chat/queries';
import { sendMessage } from '@/server/chat/messages';

export const runtime = 'nodejs';

const querySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const sendSchema = z.object({
  body: z.string().min(1).max(4000),
});

const uuid = z.string().uuid();

async function checkAccess(conversationId: string, userId: string) {
  if (!uuid.safeParse(conversationId).success) {
    return { error: NextResponse.json({ error: 'invalid_id' }, { status: 400 }) };
  }
  const inIt = await userIsInConversation(userId, conversationId);
  if (!inIt) return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  return { error: null };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await ctx.params;
  const access = await checkAccess(id, user.id);
  if (access.error) return access.error;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    before: url.searchParams.get('before') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const { messages, hasMore } = await listMessages(id, {
    limit: parsed.data.limit,
    before: parsed.data.before ? new Date(parsed.data.before) : undefined,
  });

  return NextResponse.json({ messages, hasMore });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await ctx.params;
  const access = await checkAccess(id, user.id);
  if (access.error) return access.error;

  let parsed;
  try {
    parsed = sendSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const message = await sendMessage(id, user.id, parsed.body);
  return NextResponse.json({ message }, { status: 201 });
}
