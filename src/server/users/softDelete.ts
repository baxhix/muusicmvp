/**
 * Soft delete de usuário — LGPD art. 18 (direito de exclusão).
 *
 * O que faz:
 *   1. Marca `users.deleted_at` = now (atômico com revogação).
 *   2. DELETE todas as sessões ativas (force logout em todos os
 *      devices).
 *
 * O que NÃO faz (próxima rodada / cron):
 *   - Anonimização de PII (email, name, avatar) → cron de retenção
 *     após N dias (consultar legal).
 *   - Hard delete da row depois da retenção.
 *   - Cleanup de conteúdo gerado (posts, mensagens). Decisão do
 *     produto: manter como "Usuário removido" preserva contexto
 *     pra outros usuários; deletar tudo apaga histórias coletivas.
 *
 * Idempotente: chamar em conta já soft-deleted é no-op.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { tokens, users } from '../db/schema';

export interface SoftDeleteUserResult {
  /** true se a operação efetivamente marcou (false = já estava soft-deleted). */
  marked: boolean;
  /** Quantas sessões ativas foram revogadas. */
  sessionsRevoked: number;
}

export async function softDeleteUser(userId: string): Promise<SoftDeleteUserResult> {
  return await db.transaction(async (tx) => {
    // Marca deleted_at — só atualiza se ainda não estava deletado
    // (returning() devolve só as rows efetivamente modificadas).
    const marked = await tx
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, userId))
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
