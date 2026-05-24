import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { listMateriaisTree } from '@/server/materiais/queries';

export const runtime = 'nodejs';

/**
 * GET /api/admin/materiais — devolve a árvore inteira do acervo.
 *
 * Retorna um array flat de nodes (pasta + arquivo). O cliente
 * monta a hierarquia em runtime via parentId — a UI já espera
 * este shape (era o mesmo da mock data).
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const nodes = await listMateriaisTree();
    return NextResponse.json({ nodes });
  } catch (err) {
    console.error('materiais list failed:', err);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}
