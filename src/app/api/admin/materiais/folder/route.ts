import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { createFolder } from '@/server/materiais/queries';
import { handleApiError } from '@/server/api/errors';

export const runtime = 'nodejs';

/* Schema do body — defende contra payload malformado ANTES de
 * chegar no banco. `name` obrigatório (1–200 chars), audience é
 * enum estrito, parentId é uuid ou null. */
const CreateFolderSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  description: z.string().trim().max(2000).nullish(),
  parentId: z.string().uuid().nullish(),
  audience: z.enum(['top1', 'top10', 'top50', 'top100', 'all']).default('all'),
});

/**
 * POST /api/admin/materiais/folder
 *   body JSON: { name, description?, parentId?, audience? }
 *
 * Cria uma pasta. parentId null = raiz. Não há limite de
 * profundidade — o usuário decide a hierarquia.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  try {
    const raw = await req.json().catch(() => {
      throw new Error('invalid_json');
    });
    const body = CreateFolderSchema.parse(raw);

    const node = await createFolder({
      name: body.name,
      description: body.description ?? null,
      parentId: body.parentId ?? null,
      audience: body.audience,
      createdById: admin.id,
    });
    return NextResponse.json({ node }, { status: 201 });
  } catch (err) {
    return handleApiError(err, {
      scope: 'admin.materiais.folder.create',
      ctx: { adminId: admin.id },
    });
  }
}
