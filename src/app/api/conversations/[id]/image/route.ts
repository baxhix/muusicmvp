import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { getUserRole, updateGroup } from '@/server/chat/groups';
import {
  deleteGroupImages,
  saveGroupImage,
} from '@/server/groups/storage';

export const runtime = 'nodejs';

const uuid = z.string().uuid();

/**
 * POST /api/conversations/:id/image
 *
 * Upload (or replace) a group's avatar. Body is multipart/form-data
 * with a single `file` field. 2 MB cap, jpg/png/webp/gif. Caller
 * must be owner OR admin of the group.
 *
 * Side effects:
 *   - Best-effort cleanup of any previous group image files
 *     (different filename / extension).
 *   - Updates conversations.image_url so the new URL flows through
 *     the next listConversationsForUser fetch.
 *
 * Returns: { imageUrl }.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const role = await getUserRole(id, user.id);
  if (!role || role === 'member') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

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

  // Clean up old files first — keeps the volume from growing every
  // time the user iterates on the image.
  await deleteGroupImages(id);

  let result;
  try {
    result = await saveGroupImage(id, file);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'upload_failed';
    const status =
      code === 'too_large' || code === 'unsupported_type' || code === 'no_file'
        ? 400
        : 500;
    if (status === 500) console.error('saveGroupImage failed:', err);
    return NextResponse.json({ error: code }, { status });
  }

  // Persist the new URL on the conversation row.
  await updateGroup(id, { imageUrl: result.url });

  return NextResponse.json({ imageUrl: result.url });
}
