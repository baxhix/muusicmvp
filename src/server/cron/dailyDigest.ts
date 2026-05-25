/**
 * Cron: disparo do email de resumo diário (23h59 BRT).
 *
 * Comportamento atual:
 *   - Itera TODOS os usuários ativos (deleted_at IS NULL,
 *     isOnboarded=true, email não-anonimizado).
 *   - Pra cada usuário gera dados MOCADOS de:
 *       * fanpoints ganhos no dia (0–250)
 *       * saldo total (estável-por-usuário via hash do id)
 *       * tier atual + próximo + delta pra subir
 *       * highlights perdidos (sample do pool fixo de eventos)
 *   - Manda email via sendDailyDigestEmail (template `daily_digest`,
 *     editável no admin /admin/emails/templates/daily_digest/edit).
 *   - Respeita o toggle do admin em /admin/notificacoes/daily_digest
 *     (canal email). Toggle desligado = no-op.
 *
 * Como agendar (1x ao dia, 23h59 BRT):
 *   - HTTP: POST /api/cron/daily-digest com Authorization: Bearer
 *     ${CRON_SECRET}. Cron services tipo cron-job.org / Vercel
 *     Cron / Hostinger systemd timer.
 *   - CLI: `npm run cron:daily-digest`.
 *
 * Quando o backend tiver as tabelas reais:
 *   - `user_fanpoints` (saldo total + delta diário)
 *   - `user_activities` (eventos perdidos: lives, posts, etc)
 *   - Troca buildDigestForUser por queries reais.
 *
 * Performance: O(N) onde N = usuários ativos. Pra MVP (base
 * pequena, dezenas de usuários) é OK síncrono. Pra centenas+,
 * batch via Promise.all(chunk) com concurrency-limit.
 */

import { and, eq, isNull, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { isNotificationEnabled } from '../notifications/settings';
import { sendDailyDigestEmail } from '../email/dailyDigest';
import { logger } from '../log';

/** Tier thresholds mocados — saldo total que abre cada nível.
 *  Quando o backend implementar ranking real (top X por
 *  fanpoints), substituir esta tabela por consulta ao tier
 *  derivado do rank. */
const MOCK_TIER_THRESHOLDS: { tier: string; min: number; label: string }[] = [
  { tier: 'none',   min: 0,      label: 'Top 100' },
  { tier: 'top100', min: 100,    label: 'Top 50' },
  { tier: 'top50',  min: 500,    label: 'Top 10' },
  { tier: 'top10',  min: 2_000,  label: 'Top 1' },
  { tier: 'top1',   min: 15_000, label: 'Top 1' }, // já é o número 1
];

/** Pool de "highlights" — eventos plausíveis que podem rolar na
 *  plataforma. Cron sample 1–3 por usuário pra variar. Quando o
 *  backend tiver `feed_posts`, `live_events`, `community_topics`,
 *  trocar pelas queries reais. */
const MOCK_HIGHLIGHTS_POOL: string[] = [
  '<b>Live exclusiva</b> da artista hoje às 20h — gravação ainda tá disponível.',
  '<b>3 superfãs</b> que você acompanha mandaram waves novos.',
  'Foi adicionado <b>1 vídeo novo</b> na seção Materiais (acesso Top 50).',
  '<b>Novo tópico</b> aberto na comunidade que você participa.',
  '<b>Ana Castela</b> respondeu um comentário seu no feed.',
  '<b>2 novas pessoas</b> chegaram no Top 10 e podem te ultrapassar.',
  'Drop exclusivo do <b>vinil autografado</b> liberado pra Top 1.',
  '<b>Streak de 7 dias</b> da {{userName}} prestes a expirar.',
];

/* ── Helpers mocados — substitutos das queries reais. ────────── */

/** Hash determinístico de string pra número int 0..max. Usado pra
 *  que cada user tenha um saldo "estável" entre rodadas — sem isso
 *  a cada execução o saldo total mudaria, ficaria estranho. */
function hashToRange(str: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  const span = max - min + 1;
  return min + (Math.abs(h) % span);
}

/** Pseudo-random determinístico por (userId + dateSeed). Mesmo
 *  user em dias diferentes vê valores diferentes; mesmo dia
 *  re-rodando vê os mesmos. */
function dailyHash(userId: string, dateSeed: string, max: number): number {
  return hashToRange(`${userId}:${dateSeed}`, 0, max);
}

export interface DigestStats {
  pointsToday: number;
  totalPoints: number;
  nextTierLabel: string;
  pointsToNext: number;
  missedHighlights: string[];
}

/** Calcula os stats mocados pra um usuário num dia. Determinístico
 *  por (id, date) — execução re-rodada produz os mesmos números. */
export function buildDigestForUser(
  userId: string,
  userName: string,
  dateSeed: string,
): DigestStats {
  /* pointsToday: 0–250 com curva ligeiramente skewed pra baixo
   * (multiplico por 0.7 pro range médio bater na faixa 0–175 e o
   * "ganhei pouco hoje" ser mais comum que "ganhei muito"). */
  const pointsToday = Math.floor(dailyHash(userId, dateSeed, 250) * 0.7);

  /* totalPoints: hash do userId só (estável). Range 50–14000 cobre
   * desde quem está fora dos tiers (< 100) até quase Top 1. */
  const totalPoints = hashToRange(userId, 50, 14_000);

  /* Tier atual + próximo. Encontra o maior threshold <= total e
   * pega o próximo da lista. Se já está no top1, mostra "Top 1"
   * de novo com 0 falta (mensagem de já chegou). */
  let currentIdx = 0;
  for (let i = MOCK_TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalPoints >= MOCK_TIER_THRESHOLDS[i].min) {
      currentIdx = i;
      break;
    }
  }
  const nextIdx = Math.min(currentIdx + 1, MOCK_TIER_THRESHOLDS.length - 1);
  const next = MOCK_TIER_THRESHOLDS[nextIdx];
  const isAtTop = currentIdx === MOCK_TIER_THRESHOLDS.length - 1;
  const pointsToNext = isAtTop ? 0 : Math.max(0, next.min - totalPoints);
  const nextTierLabel = isAtTop ? 'Você já é o Top 1 ✨' : next.label;

  /* Highlights: amostra 2–3 do pool, com substituição de {{userName}}
   * onde aparece. Hash determinístico pro pick não-aleatório. */
  const pickCount = 2 + dailyHash(userId, `${dateSeed}:count`, 1); // 2 ou 3
  const indices: number[] = [];
  for (let i = 0; i < pickCount; i++) {
    const idx = dailyHash(userId, `${dateSeed}:hl:${i}`, MOCK_HIGHLIGHTS_POOL.length - 1);
    if (!indices.includes(idx)) indices.push(idx);
  }
  const missedHighlights = indices.map((i) =>
    MOCK_HIGHLIGHTS_POOL[i].replace(/\{\{userName\}\}/g, userName),
  );

  return {
    pointsToday,
    totalPoints,
    nextTierLabel,
    pointsToNext,
    missedHighlights,
  };
}

/** Formata data no estilo curto BR ("25 mai"). Caller pode passar
 *  Date ou string; default = hoje. */
function formatDateLabel(d: Date = new Date()): string {
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export interface DailyDigestRunResult {
  sent: number;
  skipped: number;
  failed: number;
  durationMs: number;
}

/** Executa o run completo: filtra usuários, gera digest, envia.
 *  Idempotente em runs no mesmo dia (mesmo seed → mesmos dados),
 *  exceto pelo side-effect de gerar emails duplicados (ver TODO
 *  sobre `daily_digest_log` no header do arquivo). */
export async function runDailyDigest(): Promise<DailyDigestRunResult> {
  const startedAt = Date.now();

  /* Gate pelo toggle do admin. Se desligou, não tem o que fazer. */
  const enabled = await isNotificationEnabled('daily_digest', 'email');
  if (!enabled) {
    logger.info('cron.daily-digest.disabled');
    return { sent: 0, skipped: 0, failed: 0, durationMs: Date.now() - startedAt };
  }

  /* Filtros:
   *   - deleted_at IS NULL (anonimizados ficam fora)
   *   - is_onboarded = true (contas órfãs sem onboarding pulam)
   *   - email IS NOT NULL (defensivo — coluna é NOT NULL no schema,
   *     mas a anonimização troca pra @deleted.muusic.live; aqui
   *     filtramos esse domínio também)
   * */
  const eligible = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        eq(users.isOnboarded, true),
        isNotNull(users.email),
        sql`${users.email} NOT LIKE '%@deleted.muusic.live'`,
      ),
    );

  const dateSeed = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dateLabel = formatDateLabel();

  let sent = 0;
  let failed = 0;

  /* Sequential — base pequena, mais simples observar. Se virar
   * gargalo, paralelizar com Promise.allSettled em chunks de 10. */
  for (const u of eligible) {
    try {
      const displayName = u.name ?? u.email.split('@')[0] ?? 'fã';
      const stats = buildDigestForUser(u.id, displayName, dateSeed);
      await sendDailyDigestEmail({
        to: u.email,
        userName: displayName,
        dateLabel,
        pointsToday: stats.pointsToday,
        totalPoints: stats.totalPoints,
        nextTierLabel: stats.nextTierLabel,
        pointsToNext: stats.pointsToNext,
        missedHighlights: stats.missedHighlights,
      });
      sent++;
    } catch (err) {
      failed++;
      logger.error('cron.daily-digest.send-failed', err, { userId: u.id });
    }
  }

  const result: DailyDigestRunResult = {
    sent,
    skipped: 0,
    failed,
    durationMs: Date.now() - startedAt,
  };
  logger.info('cron.daily-digest.complete', {
    eligible: eligible.length,
    sent,
    failed,
    duration_ms: result.durationMs,
  });
  return result;
}

/** CLI entry point — `tsx src/server/cron/dailyDigest.ts`. Roda
 *  o digest agora e sai com exit code apropriado. */
async function main() {
  try {
    const result = await runDailyDigest();
    console.log(
      `[daily-digest] sent=${result.sent} failed=${result.failed} duration=${result.durationMs}ms`,
    );
    process.exit(result.failed > 0 ? 1 : 0);
  } catch (err) {
    logger.error('cron.daily-digest.fatal', err);
    process.exit(1);
  }
}

if (require.main === module) {
  void main();
}
