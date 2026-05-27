import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  deleteFaqEntry,
  getFaqEntry,
  updateFaqEntry,
} from '@/server/admin/faq';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * GET /api/admin/faq/:id
 *
 * Retorna uma entrada específica. 404 quando o id não existe.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    const entry = await getFaqEntry(id);
    if (!entry) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ entry });
  } catch (err) {
    logger.error('admin.faq.get', err);
    return NextResponse.json({ error: 'get_failed' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/faq/:id
 *
 * Body: { question?, answer?, category?, publish? }
 *
 * Update parcial. `publish=true` no body publica (gravando
 * `publishedAt=now()` se ainda não estava publicado); `publish=false`
 * desfaz a publicação (`publishedAt=null`). Sem `publish` no body,
 * o estado de publicação não é tocado.
 */
const updateSchema = z.object({
  question: z.string().min(1).max(500).optional(),
  answer: z.string().min(1).max(5_000).optional(),
  category: z.string().max(80).nullable().optional(),
  publish: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const entry = await updateFaqEntry(id, parsed.data, admin.id);
    if (!entry) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ entry });
  } catch (err) {
    logger.error('admin.faq.update', err);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/faq/:id
 *
 * Hard delete — FAQ é conteúdo público sem dependências
 * relacionais (sem comments, sem reactions). Não vale a complexidade
 * de soft-delete pra esse caso.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    const ok = await deleteFaqEntry(id);
    if (!ok) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('admin.faq.delete', err);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}
