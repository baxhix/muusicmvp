/**
 * Email de relatório diário do gestor — KPIs da plataforma das
 * últimas 24h. Disparado pelo cron matinal (06h00 BRT).
 *
 * Diferença dos outros emails: destinatário é único e fixo (o
 * gestor, definido por MANAGER_EMAIL ou default
 * demari.lets@gmail.com), não há fan-out per-usuário. Por isso o
 * input já vem com `to` resolvido pelo caller (cron script).
 *
 * Métricas com fonte mista:
 *   - totalUsers, newUsers, messages → queries reais
 *   - streams, avgSessionMinutes      → mocados (sem schema ainda)
 * Caller monta os números e passa pra cá; este helper só renderiza
 * + envia. Quando o backend tiver as tabelas faltantes, trocar a
 * fonte no cron sem tocar este arquivo.
 */

import { sendEmail } from './resend';
import { getTemplate, interpolate, getKnownTemplate } from './templates';
import { getBrandSettings } from './brand';
import { designToHtml } from './design';
import { env } from '../env';
import { logger } from '../log';

export interface SendManagerDailyReportInput {
  to: string;
  /** Data formatada (ex: "24 mai"). Caller usa o dia ANTERIOR. */
  dateLabel: string;
  totalUsers: number;
  newUsers: number;
  streams: number;
  messages: number;
  /** Tempo médio de sessão em minutos. */
  avgSessionMinutes: number;
}

export async function sendManagerDailyReportEmail(
  input: SendManagerDailyReportInput,
): Promise<void> {
  const vars = {
    dateLabel: input.dateLabel,
    totalUsers: input.totalUsers.toLocaleString('pt-BR'),
    newUsers: input.newUsers.toLocaleString('pt-BR'),
    streams: input.streams.toLocaleString('pt-BR'),
    messages: input.messages.toLocaleString('pt-BR'),
    avgSessionMinutes: input.avgSessionMinutes.toFixed(1),
    /* Admin URL — assume `admin.muusic.live` no padrão de produção.
     * Em dev (APP_URL=http://localhost:3000), aponta pra
     * localhost:3001 (admin app porta separada). */
    adminUrl: env.NODE_ENV === 'production'
      ? 'https://admin.muusic.live'
      : 'http://localhost:3001',
  };

  const [dbTemplate, brand] = await Promise.all([
    getTemplate('manager_daily_report'),
    getBrandSettings(),
  ]);

  if (dbTemplate) {
    let html: string;
    if (dbTemplate.design) {
      html = designToHtml(
        dbTemplate.design as unknown as Parameters<typeof designToHtml>[0],
        brand,
      );
    } else {
      html = dbTemplate.html;
    }
    await sendEmail({
      to: input.to,
      subject: interpolate(dbTemplate.subject, vars),
      html: interpolate(html, vars),
      kind: 'manager_daily_report',
    });
    return;
  }

  const known = getKnownTemplate('manager_daily_report');
  if (!known) {
    logger.warn('email.manager-report.no-template');
    return;
  }
  const fallbackHtml = known.defaultDesign
    ? designToHtml(known.defaultDesign, brand)
    : known.defaultHtml;
  await sendEmail({
    to: input.to,
    subject: interpolate(known.defaultSubject, vars),
    html: interpolate(fallbackHtml, vars),
    kind: 'manager_daily_report',
  });
}
