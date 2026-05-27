/**
 * GET /api/admin/acquisition/links/[id]/users?limit=&offset=
 *
 * Lista paginada de users que se cadastraram via este link.
 * Usado no detail page /admin/aquisicao/[id].
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { listUsersForLink } from '@/server/acquisition/links';
import { handleApiError } from '@/server/api/errors';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') ?? '50');
    const offset = Number(url.searchParams.get('offset') ?? '0');

    const result = await listUsersForLink(id, { limit, offset });
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, {
      scope: 'admin.acquisition.links.users',
      ctx: { actorId: auth.id },
    });
  }
}
