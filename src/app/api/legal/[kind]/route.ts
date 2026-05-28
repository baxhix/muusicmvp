import { NextResponse } from 'next/server';
import {
  getPublishedLegalDocument,
  isLegalDocumentKind,
} from '@/server/admin/legal';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * GET /api/legal/:kind
 *
 * Endpoint PÚBLICO (sem requireAdmin) — usado pelo modal in-app
 * (`LegalDocumentModal`) que abre Termos / Privacidade dentro do
 * `/app` sem navegar fora do shell.
 *
 * Retorna 404 quando o documento ainda não foi publicado — UI
 * mostra fallback "em breve" em vez de error opaco.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  if (!isLegalDocumentKind(kind)) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
  }

  try {
    const doc = await getPublishedLegalDocument(kind);
    if (!doc) {
      return NextResponse.json({ error: 'not_published' }, { status: 404 });
    }
    return NextResponse.json({ document: doc });
  } catch (err) {
    logger.error('public.legal.get', err);
    return NextResponse.json({ error: 'get_failed' }, { status: 500 });
  }
}
