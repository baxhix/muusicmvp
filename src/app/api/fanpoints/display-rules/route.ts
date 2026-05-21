import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { requireUser } from '@/server/auth/requireUser';
import { db } from '@/server/db';
import { fanpointRules } from '@/server/db/schema';
import { POINTS, type ActivityKind } from '@/server/activities/queries';
import { FANPOINT_RULE_KINDS } from '@/server/admin/fanpointRules';

export const runtime = 'nodejs';

/**
 * GET /api/fanpoints/display-rules
 *
 * Endpoint público pra qualquer usuário autenticado consultar
 * QUANTOS pontos cada ação vale. Usado pelo cliente pra montar
 * toasts + optimistic updates sem hardcodar valores no JS
 * (antes vivia em src/lib/rewards.ts REWARD_POINTS — divergia
 * do servidor quando o admin editava `fanpoint_rules`).
 *
 * Retorna o mapa completo das 7 ActivityKinds. Faltantes na
 * tabela caem no fallback POINTS const — protege contra DB
 * vazio ou migration ainda não rodada.
 *
 * Auth: requireUser (não é admin-only) — todo fã conectado pode
 * descobrir o valor das ações.
 */
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select({
      kind: fanpointRules.kind,
      points: fanpointRules.points,
    })
    .from(fanpointRules)
    .where(inArray(fanpointRules.kind, FANPOINT_RULE_KINDS as unknown as string[]));

  const byKind = new Map<string, number>(rows.map((r) => [r.kind, r.points]));

  const rules: Record<ActivityKind, number> = {} as Record<ActivityKind, number>;
  for (const kind of FANPOINT_RULE_KINDS) {
    rules[kind] = byKind.get(kind) ?? POINTS[kind];
  }

  return NextResponse.json({ rules });
}
