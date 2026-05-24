import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  getMaterialNode,
  updateNode,
  deleteNode,
  collectFilenamesDeep,
  type MaterialAudience,
  type MaterialStatus,
} from '@/server/materiais/queries';
import { deleteMaterialFile } from '@/server/materiais/storage';

export const runtime = 'nodejs';

const AUDIENCES = new Set<MaterialAudience>([
  'top1', 'top10', 'top50', 'top100', 'all',
]);
const STATUSES = new Set<MaterialStatus>([
  'rascunho', 'publicado', 'agendado', 'arquivado',
]);

interface PatchBody {
  name?: string;
  description?: string | null;
  audience?: string;
  status?: string;
  publishedToFeed?: boolean;
}

/**
 * PATCH /api/admin/materiais/[id]
 *   body JSON: { name?, description?, audience?, status?, publishedToFeed? }
 *
 * Atualiza qualquer subset dos campos editáveis. Validação por
 * campo — ignora valores fora do enum em vez de 400 (defensivo
 * pra UI velha).
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const patch: {
    name?: string;
    description?: string | null;
    audience?: MaterialAudience;
    status?: MaterialStatus;
    publishedToFeed?: boolean;
  } = {};

  if (typeof body.name === 'string' && body.name.trim()) {
    patch.name = body.name.trim();
  }
  if (body.description === null) {
    patch.description = null;
  } else if (typeof body.description === 'string') {
    patch.description = body.description.trim() || null;
  }
  if (
    typeof body.audience === 'string' &&
    AUDIENCES.has(body.audience as MaterialAudience)
  ) {
    patch.audience = body.audience as MaterialAudience;
  }
  if (
    typeof body.status === 'string' &&
    STATUSES.has(body.status as MaterialStatus)
  ) {
    patch.status = body.status as MaterialStatus;
  }
  if (typeof body.publishedToFeed === 'boolean') {
    patch.publishedToFeed = body.publishedToFeed;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 });
  }

  try {
    const updated = await updateNode(id, patch);
    if (!updated) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ node: updated });
  } catch (err) {
    console.error('materiais update failed:', err);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/materiais/[id]
 *
 * Apaga uma pasta ou arquivo. Cascade do FK derruba os
 * descendentes no DB; aqui coletamos os filenames ANTES de
 * deletar pra limpar os binários do disco.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  try {
    /* Verifica existência + tipo pra saber se precisamos do
     *  recursive cleanup. */
    const found = await getMaterialNode(id);
    if (!found) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    /* Coleta os filenames de descendentes (incluindo ele mesmo
     *  se for file). Recursive CTE no DB. */
    const filenames = await collectFilenamesDeep(id);

    /* Apaga o registro — cascade FK limpa os descendentes do DB. */
    const ok = await deleteNode(id);
    if (!ok) {
      return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
    }

    /* Best-effort cleanup dos binários no disco. Falhas aqui
     *  não invalidam a operação — o registro já foi removido,
     *  ficar com arquivo órfão é um caso recuperável via cron.
     *  Paraleliza com Promise.all pra não esperar serialmente. */
    await Promise.all(filenames.map((fn) => deleteMaterialFile(fn)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('materiais delete failed:', err);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}
