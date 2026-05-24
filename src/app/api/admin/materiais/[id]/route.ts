import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  getMaterialNode,
  updateNode,
  deleteNode,
  collectFilenamesDeep,
} from '@/server/materiais/queries';
import { deleteMaterialFile } from '@/server/materiais/storage';
import { handleApiError, NotFoundError, ValidationError } from '@/server/api/errors';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/* Schema do patch — todos os campos opcionais. Pelo menos um
 * precisa estar presente (refine no fim). Enums estritos. */
const PatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    audience: z.enum(['top1', 'top10', 'top50', 'top100', 'all']).optional(),
    status: z.enum(['rascunho', 'publicado', 'agendado', 'arquivado']).optional(),
    publishedToFeed: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'no_changes',
  });

/**
 * PATCH /api/admin/materiais/[id]
 *   body JSON: { name?, description?, audience?, status?, publishedToFeed? }
 *
 * Atualiza qualquer subset dos campos editáveis.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  if (!id) {
    return handleApiError(new ValidationError('missing_id'), {
      scope: 'admin.materiais.update',
    });
  }

  try {
    const raw = await req.json().catch(() => {
      throw new ValidationError('invalid_json');
    });
    const patch = PatchSchema.parse(raw);

    const updated = await updateNode(id, patch);
    if (!updated) throw new NotFoundError();
    return NextResponse.json({ node: updated });
  } catch (err) {
    return handleApiError(err, {
      scope: 'admin.materiais.update',
      ctx: { id },
    });
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
    return handleApiError(new ValidationError('missing_id'), {
      scope: 'admin.materiais.delete',
    });
  }

  try {
    /* Verifica existência + tipo pra saber se precisamos do
     *  recursive cleanup. */
    const found = await getMaterialNode(id);
    if (!found) throw new NotFoundError();

    /* Coleta os filenames de descendentes (incluindo ele mesmo
     *  se for file). Recursive CTE no DB. */
    const filenames = await collectFilenamesDeep(id);

    /* Apaga o registro — cascade FK limpa os descendentes do DB. */
    const ok = await deleteNode(id);
    if (!ok) {
      throw new Error('delete_failed');
    }

    /* Best-effort cleanup dos binários no disco. Falhas aqui
     *  não invalidam a operação — o registro já foi removido,
     *  ficar com arquivo órfão é um caso recuperável via cron.
     *  Paraleliza com Promise.all pra não esperar serialmente. */
    const results = await Promise.allSettled(
      filenames.map((fn) => deleteMaterialFile(fn)),
    );
    const orphans = results.filter((r) => r.status === 'rejected').length;
    if (orphans > 0) {
      logger.warn('admin.materiais.delete.orphans', {
        id,
        orphan_count: orphans,
        total: filenames.length,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, {
      scope: 'admin.materiais.delete',
      ctx: { id },
    });
  }
}
