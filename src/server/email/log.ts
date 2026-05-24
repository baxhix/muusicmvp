/**
 * Audit trail de TODO envio de email.
 *
 * Chamado por `sendEmailWithRetry` em `./resend.ts` — passa pelo
 * caminho central uma única vez por email enviado. Logar aqui é
 * "free": já temos `to/subject/duration` no escopo do call.
 *
 * Falha do log NÃO bloqueia o envio. Se gravar no DB der ruim
 * (raro), o email já saiu pelo Resend — a auditoria fica com
 * gap mas o usuário recebe.
 */

import { and, eq, gte, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import { emailLogs } from '../db/schema';
import { logger } from '../log';

export interface RecordEmailSendInput {
  to: string;
  kind: string;
  subject: string;
  status: 'sent' | 'failed';
  errorMessage?: string | null;
  campaignId?: string | null;
  durationMs?: number | null;
}

export async function recordEmailSend(
  input: RecordEmailSendInput,
): Promise<void> {
  try {
    await db.insert(emailLogs).values({
      to: input.to,
      kind: input.kind,
      subject: input.subject,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      campaignId: input.campaignId ?? null,
      durationMs: input.durationMs ?? null,
    });
  } catch (err) {
    // Não propaga — não queremos quebrar o sender por causa do log.
    logger.error('email.log.record-failed', err, {
      kind: input.kind,
      status: input.status,
    });
  }
}

/* ──────────────────────────────────────────────────────────────
 * Queries pra UI admin.
 * ────────────────────────────────────────────────────────────── */

export interface ListLogsOptions {
  limit?: number;
  offset?: number;
  kind?: string;
  status?: 'sent' | 'failed';
  /** Filtro por substring no destinatário. */
  toContains?: string;
  /** Cota o resultado pra logs dos últimos N dias. */
  sinceDays?: number;
}

export async function listEmailLogs(opts: ListLogsOptions = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);

  const filters = [];
  if (opts.kind) filters.push(eq(emailLogs.kind, opts.kind));
  if (opts.status) filters.push(eq(emailLogs.status, opts.status));
  if (opts.toContains) {
    filters.push(sql`${emailLogs.to} ILIKE ${'%' + opts.toContains + '%'}`);
  }
  if (opts.sinceDays && opts.sinceDays > 0) {
    const since = new Date(Date.now() - opts.sinceDays * 86_400_000);
    filters.push(gte(emailLogs.sentAt, since));
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  const items = await db
    .select()
    .from(emailLogs)
    .where(where)
    .orderBy(desc(emailLogs.sentAt))
    .limit(limit)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: sql<number>`COUNT(*)::int` })
    .from(emailLogs)
    .where(where);

  return { items, total };
}

/* ──────────────────────────────────────────────────────────────
 * Métricas pro dashboard de emails.
 * ────────────────────────────────────────────────────────────── */

export interface EmailMetrics {
  last30d: {
    total: number;
    sent: number;
    failed: number;
    failureRate: number;
    avgDurationMs: number | null;
  };
  byKindLast30d: Array<{ kind: string; total: number; sent: number; failed: number }>;
  /** Buckets diários — pro gráfico. */
  daily: Array<{ day: string; sent: number; failed: number }>;
}

export async function getEmailMetrics(days = 30): Promise<EmailMetrics> {
  const since = new Date(Date.now() - days * 86_400_000);

  // KPIs agregados.
  const totals = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      sent: sql<number>`SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END)::int`,
      failed: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::int`,
      avgDuration: sql<number | null>`AVG(duration_ms)::float`,
    })
    .from(emailLogs)
    .where(gte(emailLogs.sentAt, since));

  const t = totals[0];
  const total = t?.total ?? 0;
  const sent = t?.sent ?? 0;
  const failed = t?.failed ?? 0;

  // Breakdown por tipo.
  const byKind = await db
    .select({
      kind: emailLogs.kind,
      total: sql<number>`COUNT(*)::int`,
      sent: sql<number>`SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END)::int`,
      failed: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::int`,
    })
    .from(emailLogs)
    .where(gte(emailLogs.sentAt, since))
    .groupBy(emailLogs.kind)
    .orderBy(desc(sql`COUNT(*)`));

  // Buckets diários.
  const daily = await db.execute(sql`
    SELECT
      to_char(date_trunc('day', sent_at), 'YYYY-MM-DD') AS day,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END)::int AS sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::int AS failed
    FROM email_logs
    WHERE sent_at >= ${since.toISOString()}
    GROUP BY date_trunc('day', sent_at)
    ORDER BY date_trunc('day', sent_at) ASC
  `);

  return {
    last30d: {
      total,
      sent,
      failed,
      failureRate: total > 0 ? failed / total : 0,
      avgDurationMs: t?.avgDuration ?? null,
    },
    byKindLast30d: byKind,
    daily: daily.rows.map((r) => ({
      day: r.day as string,
      sent: r.sent as number,
      failed: r.failed as number,
    })),
  };
}
