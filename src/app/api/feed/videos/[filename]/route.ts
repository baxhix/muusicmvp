import { resolveFeedVideoPath } from '@/server/feed/storage';
import { serveFile } from '@/server/storage/serveFile';

export const runtime = 'nodejs';

/**
 * Public route — serves admin-uploaded videos por filename.
 *
 * Sem auth (feed posts são públicos). Path traversal protegido pelo
 * whitelist regex em `resolveFeedVideoPath`. `serveFile` cuida de:
 *   - Streaming (RAM constante mesmo em vídeo grande)
 *   - HTTP Range support — necessário pro <video> seekbar funcionar
 *     (browser baixa só o pedaço solicitado, não o vídeo inteiro)
 *   - ETag → 304 quando cliente já cacheou
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;
  return serveFile(req, resolveFeedVideoPath(filename), filename);
}
