import { promises as fs } from 'node:fs';
import { NextResponse } from 'next/server';
import {
  contentTypeOf,
  resolveReportImagePath,
} from '@/server/reports/storage';

export const runtime = 'nodejs';

/**
 * Public route — serves uploaded report-evidence images. Admins
 * need to load these from the moderation dashboard, and the URL
 * lives in `reports.image_url`. The filename whitelist in
 * resolveReportImagePath prevents path traversal.
 *
 * Cache-control is immutable since the random suffix makes each URL
 * unique to a single upload.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;
  const p = resolveReportImagePath(filename);
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
