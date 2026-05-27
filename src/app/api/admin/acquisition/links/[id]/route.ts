/**
 * GET    /api/admin/acquisition/links/[id]        → detalhe do link
 * DELETE /api/admin/acquisition/links/[id]        → soft delete (archive)
 *
 * O detail vem na response GET; a lista de users atribuídos vem
 * de /api/admin/acquisition/links/[id]/users (route separada
 * pra paginação independente).
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  archiveArtistLink,
  getArtistLinkById,
} from '@/server/acquisition/links';
import { handleApiError, NotFoundError } from '@/server/api/errors';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await context.params;
    const link = await getArtistLinkById(id);
    if (!link) throw new NotFoundError('link_not_found');
    return NextResponse.json({ link });
  } catch (err) {
    return handleApiError(err, {
      scope: 'admin.acquisition.links.detail',
      ctx: { actorId: auth.id },
    });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await context.params;
    const existing = await getArtistLinkById(id);
    if (!existing) throw new NotFoundError('link_not_found');

    await archiveArtistLink(id);
    return NextResponse.json({ ok: true, archivedId: id });
  } catch (err) {
    return handleApiError(err, {
      scope: 'admin.acquisition.links.archive',
      ctx: { actorId: auth.id },
    });
  }
}
