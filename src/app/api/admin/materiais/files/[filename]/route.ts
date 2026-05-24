import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { resolveMaterialPath, contentTypeOf } from '@/server/materiais/storage';

export const runtime = 'nodejs';

/**
 * GET /api/admin/materiais/files/[filename]
 *
 * Serve o binário cru com Content-Type correto. Admin-only —
 * a versão pública (com filtro de audiência por usuário) será
 * um endpoint separado quando for hora de expor pros fãs.
 *
 * Filename é validado contra path traversal pelo
 * resolveMaterialPath; qualquer pattern fora do esperado
 * retorna 404.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { filename } = await ctx.params;
  const p = resolveMaterialPath(filename);
  if (!p) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const buf = await fs.readFile(p);
    /* Buffer → Uint8Array → BlobPart pra contentar o tipo do
     *  Response do edge runtime (Node Buffer != Uint8Array
     *  strict mas é binary-compatible). */
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': contentTypeOf(filename),
        /* Cache agressivo — o filename tem random suffix
         *  imutável por upload (saveMaterialFile garante). */
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}
