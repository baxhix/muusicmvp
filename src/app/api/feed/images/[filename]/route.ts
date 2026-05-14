import { promises as fs } from 'node:fs';
import { NextResponse } from 'next/server';
import {
  contentTypeOf,
  resolveFeedImagePath,
} from '@/server/feed/storage';

export const runtime = 'nodejs';

/**
 * Public route — serves admin-uploaded feed images by filename.
 * No auth required (feed posts are public anyway). The filename
 * whitelist in resolveFeedImagePath prevents path traversal. Same
 * pattern + cache strategy as /api/avatars/[filename].
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;
  const p = resolveFeedImagePath(filename);
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
    },
  });
}
