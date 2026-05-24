import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  getMaterialNode,
  incrementDownloads,
} from '@/server/materiais/queries';
import { resolveMaterialPath } from '@/server/materiais/storage';
import { serveFile } from '@/server/storage/serveFile';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * GET /api/admin/materiais/[id]/download
 *
 * Faz três coisas:
 *   1. Resolve o node por ID.
 *   2. Increment do contador `downloads` (analytics, fire-and-forget).
 *   3. Stream do binário com `Content-Disposition: attachment`
 *      forçando download. Filename na resposta usa o `name`
 *      user-friendly (ex: "palco-encerramento.jpg") em vez do
 *      sanitizado interno com UUID prefix.
 *
 * `serveFile` cuida do streaming — antes carregava o arquivo
 * inteiro pra RAM, o que era problema em downloads grandes
 * (50MB zips) com vários users simultâneos.
 *
 * Cache-Control `no-store` porque é uma ação contábil (incrementa
 * downloads); proxies não devem servir cópia cacheada.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  const found = await getMaterialNode(id);
  if (!found) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (found.node.type !== 'file' || !found.node.filename) {
    return NextResponse.json({ error: 'not_a_file' }, { status: 400 });
  }

  /* Analytics — fire-and-forget. Falha aqui não compromete download. */
  void incrementDownloads(id).catch((err) => {
    logger.error('materiais.download.counter', err, { id });
  });

  /* Sanitize do filename de saída — RFC 5987 recomenda filename*
   * pra unicode; aqui ASCII simples é suficiente. */
  const safeName = found.node.name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 200);

  return serveFile(
    req,
    resolveMaterialPath(found.node.filename),
    found.node.filename,
    {
      downloadAs: safeName,
      cacheControl: 'no-store',
    },
  );
}
