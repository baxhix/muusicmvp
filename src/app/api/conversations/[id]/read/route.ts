import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { markConversationRead, userIsInConversation } from '@/server/chat/queries';

export const runtime = 'nodejs';

const uuid = z.string().uuid();

/**
 * Marks every message in the conversation as read for the calling user
 * (sets `last_read_message_id` to the latest message in the thread).
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const inIt = await userIsInConversation(user.id, id);
  if (!inIt) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  await markConversationRead(id, user.id);
  return NextResponse.json({ ok: true });
}
