import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { updateProfile } from '@/server/users/queries';

export const runtime = 'nodejs';

const bodySchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    avatarUrl: z.string().url().max(500).optional(),
  })
  .refine((v) => v.name !== undefined || v.avatarUrl !== undefined, {
    message: 'at least one field required',
  });

export async function PATCH(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  await updateProfile(user.id, parsed);
  return NextResponse.json({ ok: true });
}
