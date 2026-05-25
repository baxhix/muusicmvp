/**
 * Soft delete de usuário — LGPD art. 18 (direito de exclusão).
 *
 * O que faz:
 *   1. Marca `users.deleted_at` = now (atômico com revogação).
 *   2. Anonimiza o email pra
 *      `<userId>@deleted.muusic.live` — libera o email original
 *      pra um novo cadastro IMEDIATO (antes ficava preso pelo
 *      UNIQUE constraint enquanto a row existia).
 *   3. DELETE todas as sessões ativas (force logout em todos os
 *      devices).
 *
 * O que NÃO faz (próxima rodada / cron):
 *   - Anonimização completa de PII (name, avatar) → cron de
 *     retenção após N dias (consultar legal).
 *   - Hard delete da row depois da retenção.
 *   - Cleanup de conteúdo gerado (posts, mensagens). Decisão do
 *     produto: manter como "Usuário removido" preserva contexto
 *     pra outros usuários; deletar tudo apaga histórias coletivas.
 *
 * Idempotente: chamar em conta já soft-deleted é no-op (o UPDATE
 * filtra por deletedAt IS NULL).
 */

import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { tokens, users } from '../db/schema';

export interface SoftDeleteUserResult {
  /** true se a operação efetivamente marcou (false = já estava soft-deleted). */
  marked: boolean;
  /** Quantas sessões ativas foram revogadas. */
  sessionsRevoked: number;
}

/** Constrói o email "tombstone" determinístico pra um userId. Mesmo
 *  formato sempre — facilita debugging + garante unicidade (userId
 *  é único). Não é entregável (domínio `.muusic.live` controlado
 *  por nós + subdomínio `deleted` não roteado). */
function anonymizedEmailFor(userId: string): string {
  return `${userId}@deleted.muusic.live`;
}

export async function softDeleteUser(userId: string): Promise<SoftDeleteUserResult> {
  return await db.transaction(async (tx) => {
    /* UPDATE atômico — só passa se ainda não estava deletado.
     * Sem o WHERE em deletedAt IS NULL, chamadas concorrentes
     * sobrescreveriam o email anonimizado (que vira único pela
     * combinação userId+timestamp não é problema, mas previne
     * trabalho duplicado). */
    const marked = await tx
      .update(users)
      .set({
        deletedAt: new Date(),
        email: anonymizedEmailFor(userId),
      })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({ id: users.id, deletedAt: users.deletedAt });

    // Revoga todas as sessions ativas do usuário (kind='session').
    // Magic tokens não precisam ser deletados — TTL curto (15min)
    // + filtro de soft-delete em /verify garante que não convertem.
    const revoked = await tx
      .delete(tokens)
      .where(eq(tokens.userId, userId))
      .returning({ tokenHash: tokens.tokenHash });

    return {
      marked: marked.length > 0,
      sessionsRevoked: revoked.length,
    };
  });
}
