import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { listAddressesForAdmin } from '@/server/users/addresses';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/admin/users/:id/addresses — endereços cadastrados de um
 * usuário, read-only, pro detalhe do usuário no admin. Reflete o que o
 * usuário gerencia em Loja Fanverse / Meus dados.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    const addresses = await listAddressesForAdmin(id);
    return NextResponse.json({ addresses });
  } catch (err) {
    logger.error('admin.users.addresses', err);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}
