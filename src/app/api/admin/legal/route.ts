import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { listLegalDocuments } from '@/server/admin/legal';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * GET /api/admin/legal
 *
 * Retorna ambos os documentos legais (terms_of_use + privacy_policy).
 * Usado pela UI /admin/site/lgpd pra render dos dois cards lado a
 * lado (ou tabs).
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const items = await listLegalDocuments();
    return NextResponse.json({ items });
  } catch (err) {
    logger.error('admin.legal.list', err);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}
