import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { resolveMaterialPath } from '@/server/materiais/storage';
import { serveFile } from '@/server/storage/serveFile';

export const runtime = 'nodejs';

/**
 * GET /api/admin/materiais/files/[filename]
 *
 * Serve o binário cru. Admin-only — a versão pública (com filtro
 * de audiência por usuário) é um endpoint separado.
 *
 * Filename validado contra path traversal pelo `resolveMaterialPath`.
 * `serveFile` cuida de streaming + ETag + cache imutável (filename
 * tem random suffix por upload, então a URL é imutável).
 *
 * Cache `private` em vez de `public` — material é exclusivo e pode
 * estar gated por tier de fã; não queremos shared cache em proxies.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { filename } = await ctx.params;
  return serveFile(req, resolveMaterialPath(filename), filename, {
    cacheControl: 'private, max-age=31536000, immutable',
  });
}
