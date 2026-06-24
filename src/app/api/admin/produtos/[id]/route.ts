import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  updateProduct,
  deleteProduct,
  productSchema,
} from '@/server/products/queries';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Um produto específico.
 *
 *   PATCH  /api/admin/produtos/:id { ... }  → atualiza (campos parciais)
 *   DELETE /api/admin/produtos/:id          → remove
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let parsed;
  try {
    // Aceita atualização parcial.
    parsed = productSchema.partial().parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const product = await updateProduct(id, parsed);
    if (!product) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ product });
  } catch (err) {
    logger.error('admin.produtos.update', err);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
}

export async function DELETE(
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
    const ok = await deleteProduct(id);
    if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('admin.produtos.delete', err);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}
