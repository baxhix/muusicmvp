/**
 * DELETE /api/admin/emails/templates/:kind
 *
 * Remove um template editado do DB. Use cases:
 *   - "Restaurar default": deletar o row faz o sistema cair pro
 *     hardcoded (KNOWN_TEMPLATES) sem precisar de toggle isActive.
 *   - Remover um template custom que o admin criou e não quer mais.
 *
 * Não deleta o KNOWN_TEMPLATES (catálogo em código) — só o row
 * persistido. Templates conhecidos sem row continuam funcionando
 * via fallback.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { db } from '@/server/db';
import { emailTemplates } from '@/server/db/schema';
import { handleApiError, ValidationError } from '@/server/api/errors';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

const kindSchema = z.string().min(1).max(80).regex(/^[a-z0-9_]+$/);

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { kind } = await params;
    const parsed = kindSchema.safeParse(kind);
    if (!parsed.success) throw new ValidationError('invalid_kind');

    const deleted = await db
      .delete(emailTemplates)
      .where(eq(emailTemplates.kind, parsed.data))
      .returning({ kind: emailTemplates.kind });

    logger.info('admin.emails.templates.delete', {
      kind: parsed.data,
      deleted: deleted.length > 0,
      actorId: auth.id,
    });

    return NextResponse.json({ ok: true, deleted: deleted.length > 0 });
  } catch (err) {
    return handleApiError(err, {
      scope: 'admin.emails.templates.delete',
      ctx: { actorId: auth.id },
    });
  }
}
