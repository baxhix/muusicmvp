import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  getLegalDocument,
  isLegalDocumentKind,
  saveLegalDocument,
} from '@/server/admin/legal';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * GET /api/admin/legal/:kind
 *
 * Retorna o documento (terms_of_use ou privacy_policy). Não 404
 * — `getLegalDocument` cria a row default se faltar, então a
 * resposta SEMPRE existe.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { kind } = await params;
  if (!isLegalDocumentKind(kind)) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
  }

  try {
    const document = await getLegalDocument(kind);
    return NextResponse.json({ document });
  } catch (err) {
    logger.error('admin.legal.get', err);
    return NextResponse.json({ error: 'get_failed' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/legal/:kind
 *
 * Body: { body: string, title?: string }
 *
 * Salva o documento (rascunho). NÃO publica — o site público
 * continua vendo a última versão publicada. Pra publicar, use
 * POST /api/admin/legal/:kind/publish.
 */
const saveSchema = z.object({
  body: z.string().max(200_000),
  title: z.string().min(1).max(160).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  const { kind } = await params;
  if (!isLegalDocumentKind(kind)) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = saveSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const document = await saveLegalDocument(kind, parsed.data, admin.id);
    return NextResponse.json({ document });
  } catch (err) {
    logger.error('admin.legal.save', err);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
}
