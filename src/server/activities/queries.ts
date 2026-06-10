import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { fanpointRules, userActivities } from '../db/schema';
import { logger } from '../log';
import { redactLocation } from '../users/serialize';

export type ActivityKind =
  | 'stream'
  | 'login'
  | 'chat_started'
  | 'post_liked'
  | 'comment_posted'
  | 'post_shared'
  | 'three_streams'
  // Referral (migration 0049). Creditados via recordActivity quando
  // o convidado ativa: `referral_bonus` pro referrer, `referral_welcome`
  // pro próprio convidado.
  | 'referral_bonus'
  | 'referral_welcome';

/**
 * Fallback / spec inicial dos pontos por ação. Os valores reais
 * usados em runtime moram em `fanpoint_rules` (editável via
 * admin /configurações/fanpoints). Esses defaults entram em jogo
 * SOMENTE quando a tabela está vazia (DB nunca seedado) — então
 * o app nunca quebra por causa de migration ainda não rodada.
 *
 * Spec:
 *   • Like (heart on a feed post)         → +5
 *   • Comment (top-level OR reply)        → +10
 *   • Send (share arrow on a feed post)   → +15
 *   • Chat iniciado (first DM created)    → +3   (was 200 → MVP rebalance)
 *   • Cada 3 streams sequenciais          → +10 (awarded as a separate
 *                                                 `three_streams` row)
 *
 * `stream` itself is now worth 0 — we still insert a ledger row
 * per track change so the stream count is auditable, but the
 * reward comes from the `three_streams` milestone that gets
 * appended every third stream. Historical `stream` rows keep
 * their original 100-pt value (the column stores points at insert
 * time), so users with existing ledgers don't lose anything.
 */
export const POINTS: Record<ActivityKind, number> = {
  stream: 0,
  login: 50,
  chat_started: 3,
  post_liked: 5,
  comment_posted: 10,
  post_shared: 15,
  three_streams: 10,
  // Fallback caso fanpoint_rules ainda não tenha as linhas (a
  // migration 0049 já as semeia). Valores espelham o INSERT da 0049.
  referral_bonus: 50,
  referral_welcome: 30,
};

/**
 * Cache em-processo do mapa kind → points lido de
 * `fanpoint_rules`. Refresh a cada 60s — janela curta o
 * suficiente pro admin ver as mudanças quase em tempo real, longa
 * o suficiente pra não bater no banco a cada activity inserida.
 *
 * Multi-instância: cada processo Node mantém seu próprio cache.
 * Não há propagação imediata entre instâncias — o pior caso é
 * uma instância ainda creditar pontos pelo valor antigo por até
 * 60s após o admin patchar. Acceptable pra MVP. Quando precisar
 * de propagação instantânea, trocar por LISTEN/NOTIFY ou
 * pub/sub.
 */
let rulesCache: Map<ActivityKind, number> | null = null;
let rulesCacheExpiry = 0;
const RULES_CACHE_TTL_MS = 60_000;

export function invalidateFanpointRulesCache(): void {
  rulesCache = null;
  rulesCacheExpiry = 0;
}

async function getPointsForKind(kind: ActivityKind): Promise<number> {
  if (rulesCache === null || Date.now() > rulesCacheExpiry) {
    try {
      const rows = await db
        .select({
          kind: fanpointRules.kind,
          points: fanpointRules.points,
        })
        .from(fanpointRules);
      rulesCache = new Map(rows.map((r) => [r.kind as ActivityKind, r.points]));
      rulesCacheExpiry = Date.now() + RULES_CACHE_TTL_MS;
    } catch (err) {
      // Se a query falhar (ex.: tabela ainda não migrada), continua
      // usando o fallback hardcoded — não bloqueia o recordActivity.
      logger.error('activities.getpointsforkind-to-read-fanpoint_rules', err)
      return POINTS[kind];
    }
  }
  return rulesCache.get(kind) ?? POINTS[kind];
}

/**
 * Append a single point-bearing activity. Safe to fire-and-forget — failures
 * are logged but don't propagate to the caller (we don't want a missed
 * audit row to break a chat send or a song change).
 *
 * Returns the milestones crossed by this single activity so callers can
 * emit celebratory events (confetti + social toast). Empty array on the
 * common case where no threshold was breached, or on an insert failure.
 */
export async function recordActivity(
  userId: string,
  kind: ActivityKind,
  ctx: { trackId?: string; conversationId?: string; postId?: string } = {},
): Promise<{ crossedMilestones: number[]; newTotal: number }> {
  try {
    // Pontos vêm de fanpoint_rules (com cache de 60s). Fallback
    // pro POINTS hardcoded se a tabela estiver vazia ou
    // inacessível — recordActivity NUNCA falha silenciosamente
    // por falta de regra cadastrada.
    const points = await getPointsForKind(kind);
    await db.insert(userActivities).values({
      userId,
      kind,
      points,
      trackId: ctx.trackId ?? null,
      conversationId: ctx.conversationId ?? null,
      postId: ctx.postId ?? null,
    });
    // After persistence, derive the user's running total and figure
    // out which milestones (if any) the activity just unlocked. Pre-
    // activity total is `newTotal - thisActivityPoints`, so threshold
    // crossings are clean to compute without an extra read.
    const newTotal = await getUserPoints(userId);
    const prev = Math.max(0, newTotal - points);
    return { crossedMilestones: findCrossedMilestones(prev, newTotal), newTotal };
  } catch (err) {
    logger.error('activities.record', err, { userId, kind });
    return { crossedMilestones: [], newTotal: 0 };
  }
}

/**
 * Point milestones we celebrate. 500 is the first "you're getting
 * somewhere" recognition; after that every kilopoint is its own beat.
 * Encoded as a generator so the list scales without a hardcoded cap.
 */
export function findCrossedMilestones(prev: number, current: number): number[] {
  if (current <= prev) return [];
  const out: number[] = [];
  // Special case: the very first milestone at 500.
  if (prev < 500 && current >= 500) out.push(500);
  // Then every full kilopoint crossed.
  const prevK = Math.max(0, Math.floor(prev / 1000));
  const currK = Math.floor(current / 1000);
  for (let k = prevK + 1; k <= currK; k++) {
    out.push(k * 1000);
  }
  return out;
}

export interface RankingRow {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  /** Localização aproximada — null quando o usuário não consentiu (LGPD). */
  city: string | null;
  country: string | null;
  streams: number;
  logins: number;
  chatsStarted: number;
  points: number;
}

/**
 * Global leaderboard — total points across all users. Streams are counted
 * separately so the UI can show them next to points (per the spec).
 *
 * Users with zero activity are still included (LEFT JOIN) so a fresh user
 * doesn't disappear from search. The ORDER + LIMIT keeps the modal lean.
 */
export async function getRanking(limit = 100): Promise<RankingRow[]> {
  const result = await db.execute(sql`
    SELECT
      u.id              AS user_id,
      u.name            AS name,
      u.avatar_url      AS avatar_url,
      u.city            AS city,
      u.country         AS country,
      u.location_consent AS location_consent,
      COUNT(*) FILTER (WHERE a.kind = 'stream')::int       AS streams,
      COUNT(*) FILTER (WHERE a.kind = 'login')::int        AS logins,
      COUNT(*) FILTER (WHERE a.kind = 'chat_started')::int AS chats_started,
      COALESCE(SUM(a.points), 0)::int                      AS points
    FROM users u
    LEFT JOIN user_activities a ON a.user_id = u.id
    GROUP BY u.id, u.name, u.avatar_url, u.city, u.country, u.location_consent
    ORDER BY points DESC, streams DESC, u.created_at ASC
    LIMIT ${limit}
  `);

  return result.rows.map((r) => ({
    userId: r.user_id as string,
    name: r.name as string | null,
    avatarUrl: r.avatar_url as string | null,
    // Redação por consentimento: city/country só pra quem consentiu.
    ...redactLocation(
      {
        city: r.city as string | null,
        country: r.country as string | null,
      },
      Boolean(r.location_consent),
    ),
    streams: r.streams as number,
    logins: r.logins as number,
    chatsStarted: r.chats_started as number,
    points: r.points as number,
  }));
}

export interface MyActivityRow {
  id: string;
  kind: ActivityKind;
  points: number;
  createdAt: string;
  trackTitle: string | null;
  trackArtist: string | null;
  conversationSlug: string | null;
}

/**
 * Current user's activity ledger, newest first. Hydrated with track and
 * conversation labels so the UI can render "Tocou Boiadeira" or "Iniciou
 * conversa" without a second roundtrip.
 */
export async function getUserActivities(
  userId: string,
  opts: { limit?: number; before?: Date } = {},
): Promise<{ items: MyActivityRow[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const cursor = opts.before ? opts.before.toISOString() : null;

  const result = await db.execute(sql`
    SELECT
      a.id           AS id,
      a.kind         AS kind,
      a.points       AS points,
      a.created_at   AS created_at,
      t.title        AS track_title,
      t.artist       AS track_artist,
      c.slug         AS conversation_slug
    FROM user_activities a
    LEFT JOIN tracks t        ON t.id = a.track_id
    LEFT JOIN conversations c ON c.id = a.conversation_id
    WHERE a.user_id = ${userId}
    ${cursor ? sql`AND a.created_at < ${cursor}` : sql``}
    ORDER BY a.created_at DESC
    LIMIT ${limit + 1}
  `);

  const rows = result.rows.slice(0, limit).map(
    (r): MyActivityRow => ({
      id: r.id as string,
      kind: r.kind as ActivityKind,
      points: r.points as number,
      createdAt: (r.created_at as Date).toISOString(),
      trackTitle: r.track_title as string | null,
      trackArtist: r.track_artist as string | null,
      conversationSlug: r.conversation_slug as string | null,
    }),
  );

  return { items: rows, hasMore: result.rows.length > limit };
}

/** Sum of points for a single user. Useful for badges / TopBar pills. */
export async function getUserPoints(userId: string): Promise<number> {
  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${userActivities.points}), 0)::int`,
    })
    .from(userActivities)
    .where(eq(userActivities.userId, userId));
  return result[0]?.total ?? 0;
}

