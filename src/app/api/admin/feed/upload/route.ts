import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { saveFeedImage } from '@/server/feed/storage';

export const runtime = 'nodejs';

/**
 * POST /api/admin/feed/upload — admin uploads a single feed image.
 *   body: multipart/form-data, field `file`.
 *
 * Multi-image posts upload one file per request and stash the
 * returned URL in the local form state. Keeps the API surface tiny
 * + means a failed file out of N doesn't block the others.
 *
 * Limits: 8 MB; image/jpeg|png|webp|gif. Caller maps the error code
 * to a Toast on the admin side.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

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

  try {
    const result = await saveFeedImage(admin.id, file);
    return NextResponse.json({ url: result.url, filename: result.filename });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'write_failed';
    const status =
      code === 'too_large' ? 413 :
      code === 'unsupported_type' ? 415 :
      code === 'no_file' ? 400 :
      500;
    if (status === 500) console.error('feed image upload failed:', err);
    return NextResponse.json({ error: code }, { status });
  }
}
