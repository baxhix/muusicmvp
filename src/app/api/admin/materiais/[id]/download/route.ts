import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  getMaterialNode,
  incrementDownloads,
} from '@/server/materiais/queries';
import { resolveMaterialPath, contentTypeOf } from '@/server/materiais/storage';

export const runtime = 'nodejs';

/**
 * GET /api/admin/materiais/[id]/download
 *
 * Faz três coisas:
 *   1. Resolve o node por ID.
 *   2. Increment do contador `downloads` (analytics).
 *   3. Stream do binário com header `Content-Disposition:
 *      attachment` — força o browser a baixar em vez de exibir
 *      inline. Filename na resposta usa o `name` user-friendly
 *      do registro (ex: "palco-encerramento.jpg"), não o nome
 *      sanitizado interno (que tem o UUID prefix).
 */
export async function GET(
  _req: Request,
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

  const p = resolveMaterialPath(found.node.filename);
  if (!p) {
    return NextResponse.json({ error: 'invalid_filename' }, { status: 500 });
  }

  let buf: Buffer;
  try {
    buf = await fs.readFile(p);
  } catch {
    return NextResponse.json({ error: 'file_missing' }, { status: 404 });
  }

  /* Analytics — fire-and-forget. Mesmo se falhar não
   *  comprometemos o download. */
  void incrementDownloads(id).catch((err) => {
    console.error('materiais download counter failed:', err);
  });

  /* Sanitize do filename de saída: aspas + chars problemáticos
   *  fora do permitido pelo Content-Disposition. RFC 5987
   *  recomenda filename* pra unicode; aqui mantemos simples + ASCII. */
  const safeName = found.node.name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 200);

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': contentTypeOf(found.node.filename),
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
