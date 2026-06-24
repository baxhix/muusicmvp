import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { updateAddress, deleteAddress } from '@/server/users/addresses';
import { addressSchema } from '../route';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Um endereço específico do usuário logado.
 *
 *   PATCH  /api/me/addresses/:id { ... }  → atualiza
 *   DELETE /api/me/addresses/:id          → remove
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let parsed;
  try {
    parsed = addressSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const address = await updateAddress(auth.id, id, parsed);
    if (!address) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ address });
  } catch (err) {
    logger.error('me.addresses.update', err);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    const ok = await deleteAddress(auth.id, id);
    if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('me.addresses.delete', err);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}
