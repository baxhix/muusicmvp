import { promises as fs } from 'node:fs';
import { NextResponse } from 'next/server';
import {
  contentTypeOf,
  resolveFeedVideoPath,
} from '@/server/feed/storage';

export const runtime = 'nodejs';

/**
 * Public route — serves admin-uploaded videos by filename.
 *
 * No auth required (feed posts are public anyway). The filename
 * whitelist in resolveFeedVideoPath prevents path traversal.
 *
 * Note: this is a SIMPLE serve — entire file read into memory, no
 * HTTP Range support. For ≤100 MB clips Next.js + Node handle the
 * memory fine, but for longer clips later we should switch to a
 * streamed `Body.fromReadable` with Range header parsing so the
 * video element can seek without re-downloading.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;
  const p = resolveFeedVideoPath(filename);
  if (!p) return new NextResponse('not found', { status: 404 });

  let buf: Buffer;
  try {
    buf = await fs.readFile(p);
  } catch {
    return new NextResponse('not found', { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': contentTypeOf(filename),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(buf.byteLength),
      // Hint to browsers that we accept (future) Range requests.
      'Accept-Ranges': 'bytes',
    },
  });
}
