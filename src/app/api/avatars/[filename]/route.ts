import { resolveAvatarPath } from '@/server/avatars/storage';
import { serveFile } from '@/server/storage/serveFile';

export const runtime = 'nodejs';

/**
 * Public route — serves uploaded avatar files. Sem auth (avatares
 * são públicos por design). `resolveAvatarPath` valida path traversal
 * via regex whitelist; `serveFile` cuida de streaming + ETag.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;
  return serveFile(req, resolveAvatarPath(filename), filename);
}
