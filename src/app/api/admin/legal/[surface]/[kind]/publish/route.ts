import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  isLegalDocumentKind,
  isLegalDocumentSurface,
  publishLegalDocument,
} from '@/server/admin/legal';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * POST /api/admin/legal/:surface/:kind/publish
 *
 * Body: { body: string, title?: string }
 *
 * Publica a versão atual da combinação (surface, kind) — bumpa
 * `version`, grava `publishedAt = now()`, atualiza o body/title
 * num único request (evita race entre PATCH e POST).
 *
 * Cada surface é publicada independentemente — publicar termos
 * do app NÃO afeta termos do site nem da plataforma.
 */
const publishSchema = z.object({
  body: z.string().max(200_000),
  title: z.string().min(1).max(160).optional(),
});

export async function POST(
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
  const parsed = publishSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const document = await publishLegalDocument(
      kind,
      surface,
      parsed.data,
      admin.id,
    );
    return NextResponse.json({ document });
  } catch (err) {
    logger.error('admin.legal.publish', err);
    return NextResponse.json({ error: 'publish_failed' }, { status: 500 });
  }
}
