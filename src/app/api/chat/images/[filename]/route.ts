import { resolveChatImagePath } from '@/server/chat/storage';
import { serveFile } from '@/server/storage/serveFile';

export const runtime = 'nodejs';

/**
 * GET /api/chat/images/:filename
 *
 * Serve as imagens anexadas a mensagens. Sem auth — o filename
 * já carrega entropia suficiente (UUID da conversa + 8 bytes
 * random) pra ser unguessable; e mensagens de chat não têm o
 * mesmo perfil de privacy que profile data (já estão sendo
 * trocadas entre os participantes, que podem screenshotar).
 *
 * Path traversal blocked pelo whitelist regex em
 * `resolveChatImagePath` (defesa em camadas com `path.join`).
 *
 * `serveFile` cuida de:
 *   - Stream em chunks (RAM constante mesmo em imagens grandes)
 *   - ETag fraco → conditional GET retorna 304
 *   - Cache-Control immutable (filenames são únicos por upload)
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;
  return serveFile(req, resolveChatImagePath(filename), filename);
}
