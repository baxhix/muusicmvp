import { promises as fs } from 'node:fs';
import { NextResponse } from 'next/server';
import {
  contentTypeOf,
  resolveGroupImagePath,
} from '@/server/groups/storage';

export const runtime = 'nodejs';

/**
 * Public route — serves uploaded group avatars. Same shape as the
 * avatars + reports image routes: filename whitelist prevents path
 * traversal, cache-control immutable since each upload gets a fresh
 * random suffix.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;
  const p = resolveGroupImagePath(filename);
  if (!p) {
    return new NextResponse('not found', { status: 404 });
  }

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
