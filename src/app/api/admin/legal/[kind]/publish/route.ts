import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  isLegalDocumentKind,
  publishLegalDocument,
} from '@/server/admin/legal';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * POST /api/admin/legal/:kind/publish
 *
 * Body: { body: string, title?: string }
 *
 * Publica a versão atual — grava `body`/`title`, bumpa `version`
 * e seta `publishedAt = now()`. A partir desse momento o site
 * público (/termos ou /privacidade) passa a renderizar o
 * conteúdo novo.
 *
 * Aceita `body` no payload pra que o admin possa "editar +
 * publicar" em um único POST (evita race entre PATCH de save e
 * POST de publish, e simplifica o fluxo "Salvar e publicar" do UI).
 */
const publishSchema = z.object({
  body: z.string().max(200_000),
  title: z.string().min(1).max(160).optional(),
});

export async function POST(
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
  const parsed = publishSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const document = await publishLegalDocument(kind, parsed.data, admin.id);
    return NextResponse.json({ document });
  } catch (err) {
    logger.error('admin.legal.publish', err);
    return NextResponse.json({ error: 'publish_failed' }, { status: 500 });
  }
}
