/**
 * Email campaigns — broadcasts criados via admin.
 *
 * Ciclo de vida:
 *   1. Admin cria draft (POST /api/admin/emails/campaigns)
 *      → status='draft', total_recipients calculado da segmentação
 *   2. Admin dispara (POST /api/admin/emails/campaigns/:id/send)
 *      → status='sending', dispatcher roda
 *   3. Dispatcher itera destinatários respeitando throttle
 *      → grava email_logs por envio + atualiza sent_count/failed_count
 *   4. Final: status='sent' (ou 'failed' se algo catastrófico).
 *
 * Throttling: Resend free tier = 10 emails/s sustentado. Default
 * `RATE_PER_SECOND=8` deixa margem de segurança. Pode subir pra
 * 50/s no plano paid (env `EMAIL_RATE_PER_SECOND` quando precisar).
 *
 * Segmentos suportados (queryRecipients):
 *   'all'           — todos os usuários com email (deleted_at IS NULL)
 *   'superfans'     — top X% por fanpoints  (params: { topPct })
 *   'inactive'      — sem login há N dias    (params: { days })
 *   'city'          — usuários de uma cidade (params: { city })
 *   'custom_emails' — lista de emails fornecida (params: { emails: string[] })
 */

import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { emailCampaigns, users, type EmailCampaign } from '../db/schema';
import { sendEmail } from './resend';
import { interpolate } from './templates';
import { logger } from '../log';

const RATE_PER_SECOND = Number(process.env.EMAIL_RATE_PER_SECOND ?? '8');
const MIN_INTERVAL_MS = Math.ceil(1000 / Math.max(1, RATE_PER_SECOND));

export type Segment =
  | 'all'
  | 'superfans'
  | 'inactive'
  | 'city'
  | 'custom_emails';

export interface SegmentParams {
  /** Pra 'superfans' — top X% (default 10). */
  topPct?: number;
  /** Pra 'inactive' — sem login há N dias. */
  days?: number;
  /** Pra 'city'. */
  city?: string;
  /** Pra 'custom_emails'. */
  emails?: string[];
}

/**
 * Resolve a lista de destinatários a partir do segmento + params.
 * Usado tanto na criação (pra estimar `total_recipients`) quanto
 * no dispatch.
 */
export async function queryRecipients(
  segment: Segment,
  params: SegmentParams = {},
): Promise<string[]> {
  switch (segment) {
    case 'all': {
      const rows = await db
        .select({ email: users.email })
        .from(users)
        .where(and(isNull(users.deletedAt), isNotNull(users.email)));
      return rows.map((r) => r.email);
    }

    case 'superfans': {
      const topPct = Math.max(1, Math.min(100, params.topPct ?? 10));
      // Subquery: ranking de usuários por fanpoints.
      // Limit baseado em ceil(total * topPct/100).
      const totalQ = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(users)
        .where(isNull(users.deletedAt));
      const totalUsers = totalQ[0]?.count ?? 0;
      const limit = Math.max(1, Math.ceil((totalUsers * topPct) / 100));

      const rows = await db.execute(sql`
        SELECT u.email
        FROM users u
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(points), 0)::int AS total
          FROM user_activities
          WHERE user_id = u.id
        ) p ON TRUE
        WHERE u.deleted_at IS NULL AND u.email IS NOT NULL
        ORDER BY p.total DESC, u.created_at ASC
        LIMIT ${limit}
      `);
      return rows.rows.map((r) => r.email as string);
    }

    case 'inactive': {
      const days = Math.max(1, params.days ?? 30);
      const cutoff = new Date(Date.now() - days * 86_400_000);
      // last_seen_at < cutoff OR is null (nunca logou)
      const rows = await db
        .select({ email: users.email })
        .from(users)
        .where(
          and(
            isNull(users.deletedAt),
            isNotNull(users.email),
            // se nunca logou também conta como inativo (defensive)
            sql`(${users.lastSeenAt} IS NULL OR ${users.lastSeenAt} < ${cutoff.toISOString()})`,
          ),
        );
      return rows.map((r) => r.email);
    }

    case 'city': {
      const city = (params.city ?? '').trim();
      if (!city) return [];
      const rows = await db
        .select({ email: users.email })
        .from(users)
        .where(
          and(
            isNull(users.deletedAt),
            isNotNull(users.email),
            sql`${users.city} ILIKE ${city}`,
          ),
        );
      return rows.map((r) => r.email);
    }

    case 'custom_emails': {
      const list = (params.emails ?? [])
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && e.includes('@'));
      // dedup
      return Array.from(new Set(list));
    }

    default:
      return [];
  }
}

export interface CreateCampaignInput {
  name: string;
  subject: string;
  html: string;
  segment: Segment;
  segmentParams?: SegmentParams;
  scheduledAt?: Date | null;
  createdBy: string;
}

export async function createCampaign(
  input: CreateCampaignInput,
): Promise<EmailCampaign> {
  const recipients = await queryRecipients(
    input.segment,
    input.segmentParams ?? {},
  );
  const rows = await db
    .insert(emailCampaigns)
    .values({
      name: input.name,
      subject: input.subject,
      html: input.html,
      segment: input.segment,
      segmentParams: (input.segmentParams ?? {}) as Record<string, unknown>,
      status: 'draft',
      scheduledAt: input.scheduledAt ?? null,
      totalRecipients: recipients.length,
      createdBy: input.createdBy,
    })
    .returning();
  return rows[0];
}

export async function listCampaigns(): Promise<EmailCampaign[]> {
  return await db
    .select()
    .from(emailCampaigns)
    .orderBy(desc(emailCampaigns.createdAt))
    .limit(100);
}

export async function getCampaign(id: string): Promise<EmailCampaign | null> {
  const rows = await db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function cancelCampaign(id: string): Promise<EmailCampaign | null> {
  const rows = await db
    .update(emailCampaigns)
    .set({ status: 'canceled', completedAt: new Date() })
    .where(
      and(
        eq(emailCampaigns.id, id),
        // Só pode cancelar drafts ou sending — quem já mandou
        // tudo já mandou.
        sql`status IN ('draft', 'sending')`,
      ),
    )
    .returning();
  return rows[0] ?? null;
}

/**
 * Dispatcher de campanha — itera destinatários, envia 1 a 1
 * respeitando throttle, atualiza contadores no DB.
 *
 * NÃO bloqueia o request handler. Após enfileirar (chamar este
 * helper sem await), o handler responde 202 imediatamente; o
 * dispatcher roda em background até completar.
 *
 * Se o processo cair no meio do dispatch, a campanha fica em
 * status='sending' indefinidamente. Manualmente pode marcar como
 * 'failed' e iniciar outra. Próxima iteração: persistir índice
 * do último destinatário processado pra recovery.
 */
export async function dispatchCampaign(id: string): Promise<void> {
  const campaign = await getCampaign(id);
  if (!campaign) {
    logger.warn('email.campaign.dispatch.not-found', { campaignId: id });
    return;
  }
  if (campaign.status !== 'draft' && campaign.status !== 'sending') {
    logger.warn('email.campaign.dispatch.bad-status', {
      campaignId: id,
      status: campaign.status,
    });
    return;
  }

  // Marca como sending.
  await db
    .update(emailCampaigns)
    .set({ status: 'sending' })
    .where(eq(emailCampaigns.id, id));

  const recipients = await queryRecipients(
    campaign.segment as Segment,
    (campaign.segmentParams ?? {}) as SegmentParams,
  );

  logger.info('email.campaign.dispatch.start', {
    campaignId: id,
    recipients: recipients.length,
    ratePerSecond: RATE_PER_SECOND,
  });

  let sent = 0;
  let failed = 0;
  const startedAt = Date.now();

  for (let i = 0; i < recipients.length; i++) {
    const to = recipients[i];
    const tickStart = Date.now();

    try {
      await sendEmail({
        to,
        subject: campaign.subject,
        html: interpolate(campaign.html, { email: to }),
        kind: 'campaign',
        campaignId: id,
      });
      sent++;
    } catch {
      failed++;
      // sendEmail já gravou no email_logs com status='failed';
      // não precisa duplicar aqui.
    }

    // Atualiza contadores a cada 10 envios pro admin ver progresso
    // sem martelar o DB.
    if ((i + 1) % 10 === 0 || i === recipients.length - 1) {
      await db
        .update(emailCampaigns)
        .set({ sentCount: sent, failedCount: failed })
        .where(eq(emailCampaigns.id, id));
    }

    // Throttle pra não estourar quota Resend.
    const elapsed = Date.now() - tickStart;
    if (elapsed < MIN_INTERVAL_MS && i < recipients.length - 1) {
      await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
    }
  }

  await db
    .update(emailCampaigns)
    .set({
      status: 'sent',
      sentCount: sent,
      failedCount: failed,
      completedAt: new Date(),
    })
    .where(eq(emailCampaigns.id, id));

  logger.info('email.campaign.dispatch.done', {
    campaignId: id,
    sent,
    failed,
    durationMs: Date.now() - startedAt,
  });
}

