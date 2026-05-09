import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { listConversationsForUser } from '@/server/chat/queries';
import { getOrCreateDm, userExists } from '@/server/chat/dm';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const conversations = await listConversationsForUser(user.id);
  return NextResponse.json({ conversations });
}

const createSchema = z.object({
  otherUserId: z.string().uuid(),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  let parsed;
  try {
    parsed = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (parsed.otherUserId === user.id) {
    return NextResponse.json({ error: 'cannot_dm_self' }, { status: 400 });
  }

  if (!(await userExists(parsed.otherUserId))) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const { id, created } = await getOrCreateDm(user.id, parsed.otherUserId);
  return NextResponse.json({ id, created }, { status: created ? 201 : 200 });
}
