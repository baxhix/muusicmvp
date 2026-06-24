import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  listProducts,
  createProduct,
  productSchema,
} from '@/server/products/queries';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * Produtos da Loja Fanverse (admin).
 *
 *   GET  /api/admin/produtos          → lista
 *   POST /api/admin/produtos { ... }  → cria
 */

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const items = await listProducts();
    return NextResponse.json({ items });
  } catch (err) {
    logger.error('admin.produtos.list', err);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  let parsed;
  try {
    parsed = productSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const product = await createProduct(parsed, admin.id);
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    logger.error('admin.produtos.create', err);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
}
