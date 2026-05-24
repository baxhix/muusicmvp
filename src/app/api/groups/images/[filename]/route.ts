import { resolveGroupImagePath } from '@/server/groups/storage';
import { serveFile } from '@/server/storage/serveFile';

export const runtime = 'nodejs';

/**
 * Public route — serves uploaded group avatars. Path traversal
 * blocked pelo regex whitelist em `resolveGroupImagePath`.
 * `serveFile` cuida de streaming + ETag + cache imutável.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;
  return serveFile(req, resolveGroupImagePath(filename), filename);
}
