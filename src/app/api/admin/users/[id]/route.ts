/**
 * Admin user actions per-ID.
 *
 *   DELETE /api/admin/users/<id>  → soft delete (LGPD-friendly).
 *
 * Soft delete por design: marca `deleted_at` e revoga sessões.
 * O usuário SOME da listagem do admin imediatamente porque
 * `listAllUsers` filtra `deleted_at IS NULL`. A row continua no
 * DB pelo período de retenção (cron anonimiza após N dias),
 * preservando integridade referencial de posts/mensagens
 * históricas.
 *
 * Por que não hard delete: dropar a row quebra FKs em
 * conversations, listening_history, fanpoints, etc. O cron de
 * anonimização limpa o PII e deixa a row "fantasma" referenciável
 * só por integridade.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { softDeleteUser } from '@/server/users/softDelete';
import { handleApiError, ValidationError } from '@/server/api/errors';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

// UUID v4-ish — drizzle usa uuid sem version-specific check.
const idSchema = z.string().uuid();

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) throw new ValidationError('invalid_user_id');

    // Defense-in-depth: admin não pode deletar a si mesmo via UI.
    // Evita o "footgun" clássico de o operador perder o próprio
    // acesso e travar o painel.
    if (parsed.data === auth.id) {
      throw new ValidationError('cannot_delete_self');
    }

    const result = await softDeleteUser(parsed.data);

    logger.info('admin.users.delete', {
      targetUserId: parsed.data,
      actorId: auth.id,
      marked: result.marked,
      sessionsRevoked: result.sessionsRevoked,
    });

    return NextResponse.json({
      ok: true,
      marked: result.marked,
      sessionsRevoked: result.sessionsRevoked,
    });
  } catch (err) {
    return handleApiError(err, {
      scope: 'admin.users.delete',
      ctx: { actorId: auth.id },
    });
  }
}
