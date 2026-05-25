/**
 * Cron: notificação de movimentação em comunidades.
 *
 * Dois gatilhos por usuário:
 *
 *   1. DIRECT — alguém respondeu o comment/topic dele OU curtiu
 *      o comment dele nas últimas 6h.
 *
 *   2. VIRAL — uma comunidade onde ele já comentou (em qualquer
 *      momento) acumulou ≥ 10 interações (topics novos +
 *      comments novos + reactions novas) nas últimas 6h.
 *
 * Ambos produzem o MESMO email com a lista de nomes (sem
 * conteúdo). Cada (user, community) honra um cooldown de 6h via
 * tabela community_notification_log — assim o user não recebe o
 * mesmo nome de comunidade 2x no mesmo dia.
 *
 * Performance: O(participantes ativos) × algumas queries. Pra
 * base pequena (dezenas-centenas de usuários) roda em segundos.
 * Em escala maior, dá pra paralelizar com `Promise.allSettled`
 * em chunks.
 *
 * Como agendar:
 *   - HTTP: POST /api/cron/community-interactions
 *   - CLI:  npm run cron:community-interactions
 *   - Recomendação: a cada 6h (00h, 06h, 12h, 18h BRT)
 */

import { and, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  users,
  communities,
  communityTopics,
  communityTopicComments,
  communityTopicCommentReactions,
  communityNotificationLog,
} from '../db/schema';
import { isNotificationEnabled } from '../notifications/settings';
import { sendCommunityInteractionsEmail } from '../email/communityInteractions';
import { logger } from '../log';

const WINDOW_HOURS = 6;
const COOLDOWN_HOURS = 6;
const VIRAL_THRESHOLD = 10;

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

export interface CommunityInteractionsRunResult {
  eligibleUsers: number;
  sent: number;
  skipped: number;
  failed: number;
  durationMs: number;
}

/**
 * Encontra (userId, communityId, reason) que devem ser notificados.
 * Junta dois gatilhos numa única lista e aplica o cooldown ao final.
 */
async function findCandidates(): Promise<
  Map<string, Map<string, 'reply' | 'reaction' | 'viral'>>
> {
  const since = hoursAgo(WINDOW_HOURS);
  /* userId -> Map<communityId, reason>. Map garante dedup quando
   * o mesmo (user, community) cai em mais de 1 gatilho. Reason
   * é só o "primeiro" detectado — ordem da iteração abaixo
   * decide a prioridade (reply > reaction > viral). */
  const candidates = new Map<
    string,
    Map<string, 'reply' | 'reaction' | 'viral'>
  >();

  const add = (
    userId: string,
    communityId: string,
    reason: 'reply' | 'reaction' | 'viral',
  ) => {
    let perUser = candidates.get(userId);
    if (!perUser) {
      perUser = new Map();
      candidates.set(userId, perUser);
    }
    if (!perUser.has(communityId)) perUser.set(communityId, reason);
  };

  /* ── Gatilho 1a: replies em comments meus (parentCommentId aponta
   *               pro meu comment) ─────────────────────────────────
   * SELECT c2.author (vítima) + topic.community FROM comments c2
   * JOIN comments c1 ON c1.id = c2.parent_comment_id
   * JOIN topics t ON t.id = c2.topic_id
   * WHERE c2.created_at >= since AND c2.author != c1.author
   *       AND c2.deleted_at IS NULL */
  const repliesToMyComment = await db.execute(sql`
    SELECT DISTINCT c1.author_id as victim_id, t.community_id
    FROM community_topic_comments c2
    JOIN community_topic_comments c1 ON c1.id = c2.parent_comment_id
    JOIN community_topics t ON t.id = c2.topic_id
    WHERE c2.created_at >= ${since}
      AND c2.deleted_at IS NULL
      AND c2.author_id != c1.author_id
      AND c1.author_id IS NOT NULL
  `);
  for (const row of repliesToMyComment as unknown as Array<{
    victim_id: string;
    community_id: string;
  }>) {
    add(row.victim_id, row.community_id, 'reply');
  }

  /* ── Gatilho 1b: replies no meu topic (autor do topic recebe se
   *               outro user comentou nele) ──────────────────────── */
  const commentsOnMyTopic = await db.execute(sql`
    SELECT DISTINCT t.author_id as victim_id, t.community_id
    FROM community_topic_comments c
    JOIN community_topics t ON t.id = c.topic_id
    WHERE c.created_at >= ${since}
      AND c.deleted_at IS NULL
      AND c.author_id != t.author_id
      AND t.author_id IS NOT NULL
  `);
  for (const row of commentsOnMyTopic as unknown as Array<{
    victim_id: string;
    community_id: string;
  }>) {
    add(row.victim_id, row.community_id, 'reply');
  }

  /* ── Gatilho 2: reactions nos meus comments ──────────────────── */
  const reactionsOnMyComments = await db.execute(sql`
    SELECT DISTINCT c.author_id as victim_id, t.community_id
    FROM community_topic_comment_reactions r
    JOIN community_topic_comments c ON c.id = r.comment_id
    JOIN community_topics t ON t.id = c.topic_id
    WHERE r.created_at >= ${since}
      AND c.deleted_at IS NULL
      AND r.user_id != c.author_id
      AND c.author_id IS NOT NULL
  `);
  for (const row of reactionsOnMyComments as unknown as Array<{
    victim_id: string;
    community_id: string;
  }>) {
    add(row.victim_id, row.community_id, 'reaction');
  }

  /* ── Gatilho 3: VIRAL — comunidades com ≥10 interações no window
   *               + usuários que já comentaram em qualquer tópico
   *               daquela comunidade.
   * Step 1: identifica as comunidades quentes. */
  const hot = await db.execute(sql`
    WITH activity AS (
      SELECT t.community_id as cid FROM community_topics t
      WHERE t.created_at >= ${since}
      UNION ALL
      SELECT t.community_id as cid FROM community_topic_comments c
      JOIN community_topics t ON t.id = c.topic_id
      WHERE c.created_at >= ${since} AND c.deleted_at IS NULL
      UNION ALL
      SELECT t.community_id as cid FROM community_topic_comment_reactions r
      JOIN community_topic_comments c ON c.id = r.comment_id
      JOIN community_topics t ON t.id = c.topic_id
      WHERE r.created_at >= ${since}
    )
    SELECT cid, COUNT(*) as total
    FROM activity
    GROUP BY cid
    HAVING COUNT(*) >= ${VIRAL_THRESHOLD}
  `);
  const hotCommunityIds = (hot as unknown as Array<{ cid: string }>).map(
    (r) => r.cid,
  );

  /* Step 2: pra cada comunidade quente, encontra TODOS os
   * autores de comments — esses entram como candidatos viral. */
  if (hotCommunityIds.length > 0) {
    const participants = await db.execute(sql`
      SELECT DISTINCT c.author_id as user_id, t.community_id
      FROM community_topic_comments c
      JOIN community_topics t ON t.id = c.topic_id
      WHERE t.community_id = ANY(${hotCommunityIds})
        AND c.author_id IS NOT NULL
        AND c.deleted_at IS NULL
    `);
    for (const row of participants as unknown as Array<{
      user_id: string;
      community_id: string;
    }>) {
      add(row.user_id, row.community_id, 'viral');
    }
  }

  return candidates;
}

/**
 * Filtra (userId, communityId) que já foram notificados no
 * cooldown window via `community_notification_log`. Mutates
 * candidates in-place.
 */
async function applyCooldown(
  candidates: Map<string, Map<string, 'reply' | 'reaction' | 'viral'>>,
): Promise<void> {
  const cooldownSince = hoursAgo(COOLDOWN_HOURS);
  const userIds = Array.from(candidates.keys());
  if (userIds.length === 0) return;

  const recent = await db
    .select({
      userId: communityNotificationLog.userId,
      communityId: communityNotificationLog.communityId,
    })
    .from(communityNotificationLog)
    .where(
      and(
        inArray(communityNotificationLog.userId, userIds),
        gte(communityNotificationLog.sentAt, cooldownSince),
      ),
    );

  for (const row of recent) {
    const perUser = candidates.get(row.userId);
    if (perUser) {
      perUser.delete(row.communityId);
      if (perUser.size === 0) candidates.delete(row.userId);
    }
  }
}

export async function runCommunityInteractions(): Promise<CommunityInteractionsRunResult> {
  const startedAt = Date.now();

  const enabled = await isNotificationEnabled(
    'community_interactions',
    'email',
  );
  if (!enabled) {
    logger.info('cron.community-interactions.disabled');
    return {
      eligibleUsers: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      durationMs: Date.now() - startedAt,
    };
  }

  const candidates = await findCandidates();
  await applyCooldown(candidates);

  const eligibleUsers = candidates.size;
  let sent = 0;
  let failed = 0;

  if (eligibleUsers === 0) {
    logger.info('cron.community-interactions.nothing-to-send');
    return {
      eligibleUsers: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      durationMs: Date.now() - startedAt,
    };
  }

  /* Resolve nomes das comunidades + emails dos users em batch.
   * Coleta todos os IDs únicos antes de bater no DB. */
  const allUserIds = Array.from(candidates.keys());
  const allCommunityIds = Array.from(
    new Set(
      Array.from(candidates.values()).flatMap((m) => Array.from(m.keys())),
    ),
  );

  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(inArray(users.id, allUserIds));

  const communityRows = await db
    .select({ id: communities.id, name: communities.name })
    .from(communities)
    .where(inArray(communities.id, allCommunityIds));

  const userById = new Map(userRows.map((u) => [u.id, u]));
  const communityNameById = new Map(communityRows.map((c) => [c.id, c.name]));

  /* Pra cada user, monta lista de nomes + manda. Sequential pra
   * não saturar Resend; base pequena justifica. */
  for (const [userId, communityMap] of candidates) {
    const user = userById.get(userId);
    if (!user || user.deletedAt || !user.email) {
      /* Soft-deleted ou sem email = pula. Não-criamos log porque
       * não chegou a "mandar" — só ignoramos. */
      continue;
    }
    if (user.email.endsWith('@deleted.muusic.live')) continue;

    const communityNames: string[] = [];
    const logEntries: Array<{
      userId: string;
      communityId: string;
      reason: string;
    }> = [];
    for (const [communityId, reason] of communityMap) {
      const name = communityNameById.get(communityId);
      if (!name) continue;
      communityNames.push(name);
      logEntries.push({ userId, communityId, reason });
    }
    if (communityNames.length === 0) continue;

    try {
      await sendCommunityInteractionsEmail({
        to: user.email,
        userName: user.name ?? user.email.split('@')[0] ?? 'fã',
        communityNames,
      });
      /* Insere no log SÓ depois do send bem-sucedido — assim em
       * caso de erro o cooldown não bloqueia o próximo retry. */
      await db.insert(communityNotificationLog).values(logEntries);
      sent++;
    } catch (err) {
      failed++;
      logger.error('cron.community-interactions.send-failed', err, {
        userId,
        community_count: communityNames.length,
      });
    }
  }

  const result: CommunityInteractionsRunResult = {
    eligibleUsers,
    sent,
    skipped: eligibleUsers - sent - failed,
    failed,
    durationMs: Date.now() - startedAt,
  };
  logger.info('cron.community-interactions.complete', {
    ...result,
  });
  return result;
}

async function main() {
  try {
    const result = await runCommunityInteractions();
    console.log(
      `[community-interactions] eligible=${result.eligibleUsers} sent=${result.sent} skipped=${result.skipped} failed=${result.failed} duration=${result.durationMs}ms`,
    );
    process.exit(result.failed > 0 ? 1 : 0);
  } catch (err) {
    logger.error('cron.community-interactions.fatal', err);
    process.exit(1);
  }
}

if (require.main === module) {
  void main();
}

/* Silencia "imported but not used" do lint quando a query SQL
 * raw substitui o Drizzle helper. Mantemos o import pra hint do
 * IDE em quem for refatorar futuramente. */
void [
  users,
  communityTopics,
  communityTopicComments,
  communityTopicCommentReactions,
  eq,
  isNull,
  lt,
];
