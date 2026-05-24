import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { saveFeedVideo } from '@/server/feed/storage';
import { logger } from '@/server/log';

export const runtime = 'nodejs';
// Videos are big — opt into the streaming body parser so 100 MB
// uploads don't get truncated by Next's default route body cap.
export const maxDuration = 60;

/**
 * POST /api/admin/feed/upload-video — admin uploads a single video.
 *   body: multipart/form-data, field `file`.
 *
 * Mirrors the image upload route but accepts video MIME types
 * (mp4 / webm / mov / ogv) up to 100 MB. Returns the public URL
 * the client stashes in `feed_posts.media[].url`.
 *
 * One upload per request, just like the image route — keeps the
 * surface tiny and means a failed file out of N doesn't block the
 * others (today there's only 1 video per post, but the pattern
 * stays consistent).
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
    const result = await saveFeedVideo(admin.id, file);
    return NextResponse.json({ url: result.url, filename: result.filename });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'write_failed';
    const status =
      code === 'too_large' ? 413 :
      code === 'unsupported_type' ? 415 :
      code === 'no_file' ? 400 :
      500;
    if (status === 500) logger.error('admin.feed.upload-video.feed-video-upload', err)
    return NextResponse.json({ error: code }, { status });
  }
}
