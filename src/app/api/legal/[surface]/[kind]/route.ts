import { NextResponse } from 'next/server';
import {
  getPublishedLegalDocument,
  isLegalDocumentKind,
  isLegalDocumentSurface,
} from '@/server/admin/legal';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * GET /api/legal/:surface/:kind
 *
 * Endpoint PÚBLICO (sem auth) — usado pelo modal in-app
 * (`LegalDocumentModal`, surface='app'), pelo site público
 * (rotas /termos e /privacidade, surface='site') e pela
 * plataforma web (surface='platform').
 *
 * Retorna 404 quando o documento ainda não foi publicado pra
 * AQUELA surface — UI mostra fallback "em breve" em vez de
 * error opaco.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ surface: string; kind: string }> },
) {
  const { surface, kind } = await params;
  if (!isLegalDocumentSurface(surface)) {
    return NextResponse.json({ error: 'invalid_surface' }, { status: 400 });
  }
  if (!isLegalDocumentKind(kind)) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
  }

  try {
    const doc = await getPublishedLegalDocument(kind, surface);
    if (!doc) {
      return NextResponse.json({ error: 'not_published' }, { status: 404 });
    }
    return NextResponse.json({ document: doc });
  } catch (err) {
    logger.error('public.legal.get', err);
    return NextResponse.json({ error: 'get_failed' }, { status: 500 });
  }
}
