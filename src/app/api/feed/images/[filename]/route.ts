import { resolveFeedImagePath } from '@/server/feed/storage';
import { serveFile } from '@/server/storage/serveFile';

export const runtime = 'nodejs';

/**
 * Public route — serves admin-uploaded feed images por filename.
 * Sem auth (feed posts são públicos). Path traversal blocked pelo
 * whitelist regex em `resolveFeedImagePath`.
 *
 * `serveFile` cuida de:
 *   - Stream em chunks (RAM constante mesmo em imagens grandes)
 *   - ETag fraco → conditional GET retorna 304 quando cliente
 *     já tem a versão cacheada
 *   - Cache-Control immutable (filenames são únicos por upload)
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;
  return serveFile(req, resolveFeedImagePath(filename), filename);
}
