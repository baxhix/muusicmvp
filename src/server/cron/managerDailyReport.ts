/**
 * Cron: relatório diário do gestor (06h00 BRT).
 *
 * Manda 1 email com KPIs do dia ANTERIOR (00:00–23:59) pro gestor
 * único — definido por MANAGER_EMAIL env, default
 * demari.lets@gmail.com.
 *
 * Métricas:
 *   - totalUsers       → COUNT(users) WHERE deleted_at IS NULL
 *   - newUsers         → COUNT(users) WHERE created_at >= yesterday
 *                        AND created_at < today (timezone BRT)
 *   - messages         → COUNT(messages) WHERE created_at >= yesterday
 *   - streams          → COUNT(listening_history) WHERE started_at na
 *                        janela. Cada play do player gera 1 row em
 *                        listening_history; contar rows = "streams".
 *   - avgSessionMinutes → MOCK (sem schema de sessions ainda)
 *
 * O mock de avgSessionMinutes é determinístico por data (hash do
 * dateSeed) pra que rodar 2x no mesmo dia retorne o mesmo número
 * — evita confusão se o cron disparar duplicado por alguma razão.
 *
 * Janela de tempo: usa "ontem 00:00 BRT" até "hoje 00:00 BRT" —
 * cobre o dia civil completo conforme o cron roda às 06h00 do
 * dia seguinte. Implementado com offset -3h (BRT é UTC-3) sem
 * libs de timezone pra manter dependência mínima.
 *
 * Como agendar:
 *   - HTTP: POST /api/cron/manager-report com Bearer ${CRON_SECRET}
 *   - CLI:  npm run cron:manager-report
 */

import { and, count, gte, isNull, lt } from 'drizzle-orm';
import { db } from '../db';
import { users, messages, listeningHistory } from '../db/schema';
import { env } from '../env';
import { isNotificationEnabled } from '../notifications/settings';
import { sendManagerDailyReportEmail } from '../email/managerDailyReport';
import { logger } from '../log';

const DEFAULT_MANAGER_EMAIL = 'demari.lets@gmail.com';

/** Calcula início/fim do dia ANTERIOR em horário BRT (UTC-3),
 *  retornando os limites como Date no formato UTC (que é o que o
 *  Postgres TIMESTAMPTZ espera). */
function yesterdayBoundsBRT(): { start: Date; end: Date; label: string } {
  const now = new Date();
  /* "Hoje BRT" = now em UTC-3. Pegamos midnight pulando pelo
   * deslocamento manual: pega o dia/mês/ano BRT como string, monta
   * a Date UTC com aquele dia 00:00, depois mais 3h pra ter o
   * 00:00 BRT em UTC absoluto. */
  const brtOffsetHours = -3;
  const brtNow = new Date(now.getTime() + brtOffsetHours * 60 * 60 * 1000);
  /* Year/Month/Day extraídos do "horário BRT virtual" como se fosse
   * UTC — assim usamos getUTC* sem cair na timezone local do server. */
  const y = brtNow.getUTCFullYear();
  const m = brtNow.getUTCMonth();
  const d = brtNow.getUTCDate();
  /* "Hoje 00:00 BRT" em UTC absoluto = (y, m, d, 03:00 UTC). */
  const todayMidnightUtc = new Date(Date.UTC(y, m, d, 3, 0, 0, 0));
  const yesterdayMidnightUtc = new Date(
    todayMidnightUtc.getTime() - 24 * 60 * 60 * 1000,
  );
  /* Label "DD mes" do dia de ontem em BRT (usa o brtNow - 1d pra
   * formatar consistente). */
  const yesterdayBrt = new Date(brtNow.getTime() - 24 * 60 * 60 * 1000);
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const label = `${yesterdayBrt.getUTCDate()} ${months[yesterdayBrt.getUTCMonth()]}`;
  return { start: yesterdayMidnightUtc, end: todayMidnightUtc, label };
}

/** Hash determinístico pra mocks por dia. Stable pra mesma data,
 *  varia entre dias. Range customizável. */
function dailyMockHash(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const span = max - min + 1;
  return min + (Math.abs(h) % span);
}

export interface ManagerReportResult {
  to: string;
  totalUsers: number;
  newUsers: number;
  messages: number;
  streams: number;
  avgSessionMinutes: number;
  dateLabel: string;
  durationMs: number;
  /** false se o toggle do admin estiver desligado OU envio falhou. */
  sent: boolean;
}

export async function runManagerDailyReport(): Promise<ManagerReportResult> {
  const startedAt = Date.now();

  /* O gestor SEMPRE recebe — esta notificação é `system: true` no
   * catálogo. Mesmo assim, checamos o toggle pra honrar
   * desativações manuais via SQL/seed. */
  const enabled = await isNotificationEnabled('manager_daily_report', 'email');
  if (!enabled) {
    logger.info('cron.manager-report.disabled');
    return {
      to: '',
      totalUsers: 0,
      newUsers: 0,
      messages: 0,
      streams: 0,
      avgSessionMinutes: 0,
      dateLabel: '',
      durationMs: Date.now() - startedAt,
      sent: false,
    };
  }

  const { start, end, label } = yesterdayBoundsBRT();

  /* ── Queries reais ───────────────────────────────────── */

  /* totalUsers — ativos (não soft-deleted). */
  const totalUsersRes = await db
    .select({ n: count() })
    .from(users)
    .where(isNull(users.deletedAt));
  const totalUsers = totalUsersRes[0]?.n ?? 0;

  /* newUsers — criados durante a janela de ontem. */
  const newUsersRes = await db
    .select({ n: count() })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        gte(users.createdAt, start),
        lt(users.createdAt, end),
      ),
    );
  const newUsers = newUsersRes[0]?.n ?? 0;

  /* messages — criadas durante a janela de ontem. */
  const messagesRes = await db
    .select({ n: count() })
    .from(messages)
    .where(and(gte(messages.createdAt, start), lt(messages.createdAt, end)));
  const messagesCount = messagesRes[0]?.n ?? 0;

  /* streams — reproduções de música. Cada play registra uma row
   * em listening_history com started_at; basta contar rows na
   * janela de ontem. Não filtramos por endedAt (play em andamento
   * conta como stream se começou no dia). */
  const streamsRes = await db
    .select({ n: count() })
    .from(listeningHistory)
    .where(
      and(
        gte(listeningHistory.startedAt, start),
        lt(listeningHistory.startedAt, end),
      ),
    );
  const streams = streamsRes[0]?.n ?? 0;

  /* ── Mock (último KPI sem schema dedicado) ────────────── */

  const seed = start.toISOString().slice(0, 10); // YYYY-MM-DD da janela
  /* avgSessionMinutes: 4–18 min, curva centralizada em 8–10.
   * Quando tivermos `user_sessions` (login/logout ou heartbeat
   * de presença ≥ 30s contínuos), trocar pela média real. */
  const avgSessionMinutes = 4 + dailyMockHash(`session:${seed}`, 0, 14);

  /* Destinatário fixo. */
  const to = env.MANAGER_EMAIL ?? DEFAULT_MANAGER_EMAIL;

  try {
    await sendManagerDailyReportEmail({
      to,
      dateLabel: label,
      totalUsers,
      newUsers,
      messages: messagesCount,
      streams,
      avgSessionMinutes,
    });
    logger.info('cron.manager-report.sent', {
      to,
      total_users: totalUsers,
      new_users: newUsers,
      messages: messagesCount,
      streams,
      avg_session: avgSessionMinutes,
    });
    return {
      to,
      totalUsers,
      newUsers,
      messages: messagesCount,
      streams,
      avgSessionMinutes,
      dateLabel: label,
      durationMs: Date.now() - startedAt,
      sent: true,
    };
  } catch (err) {
    logger.error('cron.manager-report.send-failed', err, { to });
    return {
      to,
      totalUsers,
      newUsers,
      messages: messagesCount,
      streams,
      avgSessionMinutes,
      dateLabel: label,
      durationMs: Date.now() - startedAt,
      sent: false,
    };
  }
}

/** CLI entry point — `tsx src/server/cron/managerDailyReport.ts`. */
async function main() {
  try {
    const result = await runManagerDailyReport();
    console.log(
      `[manager-report] to=${result.to} date=${result.dateLabel} ` +
      `users=${result.totalUsers} new=${result.newUsers} ` +
      `msgs=${result.messages} streams=${result.streams} ` +
      `sessAvg=${result.avgSessionMinutes}min sent=${result.sent} ` +
      `duration=${result.durationMs}ms`,
    );
    process.exit(result.sent ? 0 : 1);
  } catch (err) {
    logger.error('cron.manager-report.fatal', err);
    process.exit(1);
  }
}

if (require.main === module) {
  void main();
}
