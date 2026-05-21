import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  isFanpointRuleKind,
  upsertFanpointRule,
} from '@/server/admin/fanpointRules';

export const runtime = 'nodejs';

/**
 * PATCH /api/admin/fanpoints/rules/:kind
 *
 * Body: { points: number }
 *
 * Apenas `points` é editável per product feedback "deixe apenas a
 * quantidade de Fanpoints editável e integrada". Os demais campos
 * da linha (kind, descrição, categoria) ou são imutáveis ou não
 * existem na tabela — descrições/categorias vivem no admin UI.
 *
 * Aceita pontos negativos (penalidades como `skip_early` no
 * brainstorm). Cap leve em ±10_000 pra defender contra typo de
 * vírgula virando milhões. Se algum dia precisar mais, é só
 * subir o teto.
 */
const bodySchema = z.object({
  points: z.number().int().min(-10_000).max(10_000),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  const { kind } = await params;
  if (!isFanpointRuleKind(kind)) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    await upsertFanpointRule(kind, parsed.data.points, admin.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('upsertFanpointRule failed:', err);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
}
