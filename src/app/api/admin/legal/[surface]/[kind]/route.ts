import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  getLegalDocument,
  isLegalDocumentKind,
  isLegalDocumentSurface,
  saveLegalDocument,
} from '@/server/admin/legal';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * GET /api/admin/legal/:surface/:kind
 *
 * Retorna o documento de uma combinação específica. Não 404 —
 * `getLegalDocument` cria a row default se faltar, então a
 * resposta sempre existe.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ surface: string; kind: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { surface, kind } = await params;
  if (!isLegalDocumentSurface(surface)) {
    return NextResponse.json({ error: 'invalid_surface' }, { status: 400 });
  }
  if (!isLegalDocumentKind(kind)) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
  }

  try {
    const document = await getLegalDocument(kind, surface);
    return NextResponse.json({ document });
  } catch (err) {
    logger.error('admin.legal.get', err);
    return NextResponse.json({ error: 'get_failed' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/legal/:surface/:kind
 *
 * Body: { body: string, title?: string }
 *
 * Salva rascunho. NÃO publica — o consumidor daquela surface
 * continua vendo a última versão publicada (ou nada).
 */
const saveSchema = z.object({
  body: z.string().max(200_000),
  title: z.string().min(1).max(160).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ surface: string; kind: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  const { surface, kind } = await params;
  if (!isLegalDocumentSurface(surface)) {
    return NextResponse.json({ error: 'invalid_surface' }, { status: 400 });
  }
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
    const document = await saveLegalDocument(
      kind,
      surface,
      parsed.data,
      admin.id,
    );
    return NextResponse.json({ document });
  } catch (err) {
    logger.error('admin.legal.save', err);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
}
