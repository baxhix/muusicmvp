import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { requireUser } from '@/server/auth/requireUser';
import { deleteUserAvatars, saveAvatar } from '@/server/avatars/storage';
import { limitByIp, uploadLimiter } from '@/server/rateLimit';

export const runtime = 'nodejs';

/**
 * Upload (or replace) the current user's avatar.
 *
 * Body: multipart/form-data with a single `file` field.
 * Limits: 2 MB, jpg/png/webp/gif.
 *
 * Side effects: deletes any previous avatar file belonging to this user
 * and updates `users.avatar_url`.
 */
export async function POST(req: Request) {
  // Rate limit anti-abuse de disco/banda. Generoso pra usuário
  // legítimo (20 burst, 6/min sustentado), barra bot tentando
  // saturar o storage.
  const rl = limitByIp(req, uploadLimiter, 'avatar-upload');
  if (!rl.ok) return rl.response;

  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no_file' }, { status: 400 });
  }

  // Best-effort cleanup of any earlier upload (different extension, etc.).
  await deleteUserAvatars(user.id);

  let result;
  try {
    result = await saveAvatar(user.id, file);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'write_failed';
    const status =
      code === 'too_large' ? 413 :
      code === 'unsupported_type' ? 415 :
      code === 'no_file' ? 400 :
      500;
    return NextResponse.json({ error: code }, { status });
  }

  await db
    .update(users)
    .set({ avatarUrl: result.url })
    .where(eq(users.id, user.id));

  return NextResponse.json({ avatarUrl: result.url });
}

/**
 * Remove the current user's avatar (file + db field).
 */
export async function DELETE() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  await deleteUserAvatars(user.id);
  await db.update(users).set({ avatarUrl: null }).where(eq(users.id, user.id));

  return NextResponse.json({ ok: true });
}
