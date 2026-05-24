import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  createFolder,
  type MaterialAudience,
} from '@/server/materiais/queries';

export const runtime = 'nodejs';

const AUDIENCES = new Set<MaterialAudience>([
  'top1', 'top10', 'top50', 'top100', 'all',
]);

interface CreateFolderBody {
  name?: string;
  description?: string | null;
  parentId?: string | null;
  audience?: string;
}

/**
 * POST /api/admin/materiais/folder
 *   body JSON: { name, description?, parentId? }
 *
 * Cria uma pasta. parentId null = raiz. Não há limite de
 * profundidade — o usuário decide a hierarquia.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  let body: CreateFolderBody;
  try {
    body = (await req.json()) as CreateFolderBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'missing_name' }, { status: 400 });
  }

  const description =
    typeof body.description === 'string' && body.description.trim()
      ? body.description.trim()
      : null;
  const parentId =
    typeof body.parentId === 'string' && body.parentId.length > 0
      ? body.parentId
      : null;
  const audience =
    typeof body.audience === 'string' &&
    AUDIENCES.has(body.audience as MaterialAudience)
      ? (body.audience as MaterialAudience)
      : 'all';

  try {
    const node = await createFolder({
      name,
      description,
      parentId,
      audience,
      createdById: admin.id,
    });
    return NextResponse.json({ node }, { status: 201 });
  } catch (err) {
    console.error('materiais create folder failed:', err);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
}
