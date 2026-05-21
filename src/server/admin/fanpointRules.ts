/**
 * Admin helpers pra `fanpoint_rules` — superfície que controla
 * quantos Fanpoints cada `user_activities.kind` credita.
 *
 * O recordActivity() em src/server/activities/queries.ts consome
 * essa tabela via cache de 60s. O fluxo de edição é:
 *
 *   admin UI → PATCH /api/admin/fanpoints/rules/:kind
 *           → upsertFanpointRule()  (UPDATE points + updated_by)
 *           → invalidateFanpointRulesCache()  (cache no mesmo processo)
 *           → próximos recordActivity() pegam o valor novo
 *             (até 60s pra processos diferentes baterem no banco).
 *
 * As 7 kinds permitidas batem com o enum de `user_activities.kind`
 * — quando alguém adicionar uma nova kind, atualize esse array
 * + o seed em drizzle/0021_*.sql + o admin UI pega
 * automaticamente.
 */

import { eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { fanpointRules } from '../db/schema';
import {
  type ActivityKind,
  POINTS,
  invalidateFanpointRulesCache,
} from '../activities/queries';

export const FANPOINT_RULE_KINDS = [
  'stream',
  'login',
  'chat_started',
  'post_liked',
  'comment_posted',
  'post_shared',
  'three_streams',
] as const satisfies readonly ActivityKind[];

export function isFanpointRuleKind(value: string): value is ActivityKind {
  return (FANPOINT_RULE_KINDS as readonly string[]).includes(value);
}

export interface FanpointRuleRow {
  kind: ActivityKind;
  points: number;
  updatedAt: string;
  updatedBy: { id: string; name: string | null; email: string } | null;
}

/**
 * Lista todas as regras conhecidas — sempre as 7 kinds. Linhas que
 * não existem no DB (caso muito raro: seed pulou alguma) vêm com o
 * default do POINTS const + `updatedAt` epoch + `updatedBy=null`,
 * pra UI nunca renderizar grid quebrado.
 */
export async function listAllFanpointRules(): Promise<FanpointRuleRow[]> {
  const rows = await db
    .select({
      kind: fanpointRules.kind,
      points: fanpointRules.points,
      updatedAt: fanpointRules.updatedAt,
      updatedBy: fanpointRules.updatedBy,
    })
    .from(fanpointRules)
    .where(inArray(fanpointRules.kind, FANPOINT_RULE_KINDS as unknown as string[]));

  const byKind = new Map<string, (typeof rows)[number]>();
  for (const r of rows) byKind.set(r.kind, r);

  // Hidrata updatedBy com nome/email (lookup leve, só pros ids únicos).
  const userIds = Array.from(
    new Set(rows.map((r) => r.updatedBy).filter((x): x is string => !!x)),
  );
  const userMap = new Map<string, { id: string; name: string | null; email: string }>();
  if (userIds.length > 0) {
    const { users } = await import('../db/schema');
    const us = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, userIds));
    for (const u of us) userMap.set(u.id, u);
  }

  return FANPOINT_RULE_KINDS.map((kind) => {
    const row = byKind.get(kind);
    if (!row) {
      return {
        kind,
        points: POINTS[kind],
        updatedAt: new Date(0).toISOString(),
        updatedBy: null,
      };
    }
    return {
      kind,
      points: row.points,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy ? userMap.get(row.updatedBy) ?? null : null,
    };
  });
}

/**
 * Atualiza o valor de pontos de uma kind. Apenas `points` é
 * editável — `kind` é PK imutável, `updated_at` é setado pelo
 * helper, `updated_by` rastreia o admin que fez a alteração.
 *
 * Faz UPSERT (não UPDATE) pra cobrir o caso raro em que o seed
 * pulou uma kind — primeira PATCH cria a linha.
 *
 * Invalida o cache em-processo do recordActivity logo após o
 * commit. Outras instâncias do servidor ainda pegam o valor
 * antigo por até 60s (TTL do cache delas).
 */
export async function upsertFanpointRule(
  kind: ActivityKind,
  points: number,
  updatedById: string,
): Promise<void> {
  await db
    .insert(fanpointRules)
    .values({
      kind,
      points,
      updatedAt: new Date(),
      updatedBy: updatedById,
    })
    .onConflictDoUpdate({
      target: fanpointRules.kind,
      set: {
        points,
        updatedAt: new Date(),
        updatedBy: updatedById,
      },
    });

  invalidateFanpointRulesCache();
}

// Re-exporta o tipo pra uso nos endpoints sem precisar de import
// dupla.
export type { ActivityKind };
