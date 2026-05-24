/**
 * Cron: anonimização final de usuários soft-deleted (LGPD art. 18).
 *
 * Workflow LGPD:
 *   1. Usuário pede exclusão → `DELETE /api/me` → `softDeleteUser()`
 *      marca `deleted_at` e revoga sessões.
 *   2. Período de retenção (default 30 dias) — janela pra:
 *      - Investigações de moderação / abuso em andamento
 *      - Reverter a operação se foi clique acidental (feature
 *        "restore my account" — não implementada ainda)
 *      - Backups operacionais com PII (LGPD permite retenção
 *        técnica temporária)
 *   3. **Este script** roda diariamente, encontra usuários soft-
 *      deletados há mais de N dias, e ANONIMIZA o registro:
 *      - email → `anon+<uuid>@deleted.muusic.live` (mantém
 *        unicidade da coluna, libera o email original pra reuso)
 *      - name, avatarUrl, city, country, birthDate, interests,
 *        lat/lng → null/empty
 *      - role mantém (pra auditoria de "ex-admin")
 *      - createdAt, deletedAt mantém (datas de auditoria não são PII)
 *
 * Por que anonimizar em vez de hard-delete?
 *   - Conteúdo gerado (posts, mensagens) tem FK pra users.
 *     Hard delete cascataria e apagaria histórias coletivas.
 *   - Manter a row com PII zerada preserva o contexto ("foi
 *     postado por alguém") sem reter dados pessoais.
 *
 * Como agendar:
 *   - Hoje: rodar manualmente via `npm run cron:anonymize`.
 *   - Produção: cron-job.org ou systemd timer chamando
 *     `tsx src/server/cron/anonymizeDeletedUsers.ts` diariamente.
 *   - Futuro: BullMQ scheduled job quando tiver Redis.
 *
 * Idempotente: rodar 2x no mesmo dia anonimiza só os elegíveis
 * NÃO-anonimizados (filtro por `name != 'Usuário removido'`).
 *
 * Config:
 *   ANONYMIZE_RETENTION_DAYS — default 30. Override pra
 *   testar (curto) ou ajustar conforme política legal.
 */

import { and, eq, lt, sql, isNotNull } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { logger } from '../log';

/** Nome canônico após anonimização. Display em UI usa esse
 *  literal pra mostrar "Usuário removido" sem precisar de flag. */
export const ANONYMIZED_NAME = 'Usuário removido';

/** Período de retenção em dias. Override via env. */
function getRetentionDays(): number {
  const raw = process.env.ANONYMIZE_RETENTION_DAYS;
  if (!raw) return 30;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 30;
}

export interface AnonymizeResult {
  retentionDays: number;
  cutoff: Date;
  /** Quantos usuários foram anonimizados nesta execução. */
  anonymized: number;
  /** IDs dos usuários processados (sem PII; pra audit log). */
  userIds: string[];
}

/**
 * Anonimiza todos os usuários soft-deletados há mais de
 * `retentionDays`. Retorna detalhes pra log/monitoramento.
 *
 * Cada usuário é processado individualmente (não em batch SQL)
 * pra garantir que:
 *   - Erro num user não bloqueia os outros
 *   - O log audita cada operação separadamente
 *
 * Performance: O(N) onde N = usuários elegíveis. Tipicamente
 * baixo (poucos pedidos de exclusão por dia). Caso N cresça,
 * paginar.
 */
export async function anonymizeDeletedUsers(): Promise<AnonymizeResult> {
  const retentionDays = getRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);

  /* Encontra elegíveis: deleted_at < cutoff E ainda não anonimizado.
   * O filtro `name != ANONYMIZED_NAME` torna a operação idempotente
   * — rodar 2x no mesmo dia não re-toca rows já anonimizadas. */
  const eligible = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNotNull(users.deletedAt),
        lt(users.deletedAt, cutoff),
        // Ainda não anonimizado — name é nullable mas se for null,
        // ele já foi zerado em alguma anonimização anterior. Aqui só
        // pegamos os que ainda têm um nome real (proxy).
        sql`(${users.name} IS NULL OR ${users.name} != ${ANONYMIZED_NAME})`,
      ),
    );

  if (eligible.length === 0) {
    return { retentionDays, cutoff, anonymized: 0, userIds: [] };
  }

  const anonymized: string[] = [];
  for (const { id } of eligible) {
    try {
      /* email → único por design (UNIQUE constraint). Geramos um
       * placeholder que mantém a constraint feliz e libera o email
       * original pra reuso (caso o ex-usuário queira voltar). */
      const anonymousEmail = `anon+${id}@deleted.muusic.live`;

      await db
        .update(users)
        .set({
          email: anonymousEmail,
          name: ANONYMIZED_NAME,
          avatarUrl: null,
          city: null,
          country: null,
          countryCode: null,
          lat: null,
          lng: null,
          birthDate: null,
          age: null,
          isMinor: false,
          termsAcceptedAt: null,
          interests: null,
        })
        .where(eq(users.id, id));
      anonymized.push(id);
    } catch (err) {
      logger.error('cron.anonymize.user', err, { userId: id });
      /* Continua nos outros mesmo se este falhar. */
    }
  }

  logger.info('cron.anonymize.complete', {
    retention_days: retentionDays,
    cutoff: cutoff.toISOString(),
    anonymized_count: anonymized.length,
    eligible_count: eligible.length,
  });

  return {
    retentionDays,
    cutoff,
    anonymized: anonymized.length,
    userIds: anonymized,
  };
}

/**
 * CLI entry point — `tsx src/server/cron/anonymizeDeletedUsers.ts`
 * Roda a anonimização e sai com exit code apropriado:
 *   0  → sucesso (incluindo "nada a fazer")
 *   1  → erro inesperado
 */
async function main() {
  try {
    const result = await anonymizeDeletedUsers();
    console.log(
      `[anonymize] retention=${result.retentionDays}d cutoff=${result.cutoff.toISOString()} anonymized=${result.anonymized}`,
    );
    process.exit(0);
  } catch (err) {
    logger.error('cron.anonymize.fatal', err);
    process.exit(1);
  }
}

// Só executa main se rodado direto (não import).
if (require.main === module) {
  void main();
}
