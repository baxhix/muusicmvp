import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  listProductCategories,
  createProductCategory,
  productCategorySchema,
} from '@/server/products/categories';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * Categorias de produtos (admin).
 *
 *   GET  /api/admin/produtos/categorias          → lista
 *   POST /api/admin/produtos/categorias { ... }  → cria
 */

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const items = await listProductCategories();
    return NextResponse.json({ items });
  } catch (err) {
    logger.error('admin.produtos.categorias.list', err);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let parsed;
  try {
    parsed = productCategorySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const category = await createProductCategory(parsed);
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    logger.error('admin.produtos.categorias.create', err);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
}
