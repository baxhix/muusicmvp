import { promises as fs } from 'node:fs';
import { NextResponse } from 'next/server';
import { contentTypeOf, resolveAvatarPath } from '@/server/avatars/storage';

export const runtime = 'nodejs';

/**
 * Public route — serves uploaded avatar files. No auth required (avatars are
 * intentionally visible across the app). The filename whitelist in
 * resolveAvatarPath prevents path traversal.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;
  const p = resolveAvatarPath(filename);
  if (!p) {
    return new NextResponse('not found', { status: 404 });
  }

  let buf: Buffer;
  try {
    buf = await fs.readFile(p);
  } catch {
    return new NextResponse('not found', { status: 404 });
  }

  // Convert Buffer to ArrayBuffer slice — needed for Response body in Edge-like runtimes.
  // Filenames include a random hex suffix per upload, so URLs are immutable
  // for a given file → safe to cache aggressively.
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': contentTypeOf(filename),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(buf.byteLength),
    },
  });
}
