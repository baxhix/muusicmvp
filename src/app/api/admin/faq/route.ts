import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { createFaqEntry, listFaqEntries } from '@/server/admin/faq';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * GET /api/admin/faq
 *
 * Lista todas as entradas (rascunhos + publicadas), ordenadas por
 * `sortOrder` asc. Caller é o admin UI em /admin/site/faq.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const items = await listFaqEntries();
    return NextResponse.json({ items });
  } catch (err) {
    logger.error('admin.faq.list', err);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

/**
 * POST /api/admin/faq
 *
 * Body: { question, answer, category?, publish? }
 *
 * Cria nova entrada. `publish=true` grava `publishedAt=now()`,
 * caso contrário fica rascunho. Novo registro vai pro fim da lista
 * (max sortOrder + 1).
 */
const createSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(5_000),
  category: z.string().max(80).nullable().optional(),
  publish: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const entry = await createFaqEntry(parsed.data, admin.id);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    logger.error('admin.faq.create', err);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
}
