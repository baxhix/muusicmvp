/**
 * Email de resumo diário — disparado pelo cron noturno (23h59
 * America/Sao_Paulo) pra TODOS os usuários cadastrados ativos.
 *
 * Conteúdo: fanpoints ganhos no dia, saldo total, distância pro
 * próximo tier (Top 100/50/10/1) e destaques que o user pode ter
 * perdido (lives, releases, comunidades ativas).
 *
 * Dados: tudo MOCADO por enquanto. Quando o backend tiver:
 *   - `user_fanpoints` table com saldo + delta diário
 *   - `user_activities` table com eventos de hoje
 *   - Cron de ranking aplicando os tiers de niveis
 * → trocar `buildDigestForUser` por queries reais sem mudar a UX.
 *
 * Por que email-only: o digest é uma reach-back de quem não voltou
 * hoje. Notificação in-app não tem efeito (o user nem está olhando).
 *
 * Anti-spam: 1 email/usuário/dia. O cron roda 1x à noite — se
 * rodar 2x (cron stuck, manual replay) NÃO há gate. Aceita-se
 * porque o impacto é baixo (1 email duplicado != quebra de
 * confiança). Se virar problema, adiciona uma tabela
 * `daily_digest_log` com PK (user_id, date) e gate antes de enviar.
 */

import { sendEmail } from './resend';
import { getTemplate, interpolate, getKnownTemplate } from './templates';
import { getBrandSettings } from './brand';
import { designToHtml } from './design';
import { env } from '../env';
import { logger } from '../log';

export interface SendDailyDigestEmailInput {
  to: string;
  userName: string;
  /** Data formatada (ex: "25 mai"). Caller formata na timezone certa. */
  dateLabel: string;
  /** Fanpoints ganhos hoje. */
  pointsToday: number;
  /** Saldo total acumulado. */
  totalPoints: number;
  /** Próximo tier que o user pode atingir. */
  nextTierLabel: string;
  /** Quantos pontos faltam pro próximo tier. */
  pointsToNext: number;
  /** Lista de "missed highlights" — strings prontas pra render.
   *  Caller monta a partir de eventos reais ou mock. */
  missedHighlights: string[];
}

export async function sendDailyDigestEmail(
  input: SendDailyDigestEmailInput,
): Promise<void> {
  /* Junta highlights com <br> pra renderizar como lista visual no
   * email. Empty array vira mensagem default ("Nada de novo hoje").
   * O sanitizer de paragraph já libera <br> + <b>/<i>/<em> — vem
   * via {{missedHighlights}} no template. */
  const highlightsHtml =
    input.missedHighlights.length === 0
      ? 'Nada de novo hoje — bom dormir cedo. 😴'
      : input.missedHighlights.map((h) => `• ${h}`).join('<br/>');

  const vars = {
    userName: input.userName,
    dateLabel: input.dateLabel,
    pointsToday: String(input.pointsToday),
    totalPoints: String(input.totalPoints),
    nextTierLabel: input.nextTierLabel,
    pointsToNext: String(input.pointsToNext),
    missedHighlights: highlightsHtml,
    appUrl: `${env.APP_URL.replace(/\/+$/, '')}/app`,
  };

  const [dbTemplate, brand] = await Promise.all([
    getTemplate('daily_digest'),
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
      kind: 'daily_digest',
    });
    return;
  }

  const known = getKnownTemplate('daily_digest');
  if (!known) {
    logger.warn('email.daily-digest.no-template', { kind: 'daily_digest' });
    return;
  }
  const fallbackHtml = known.defaultDesign
    ? designToHtml(known.defaultDesign, brand)
    : known.defaultHtml;
  await sendEmail({
    to: input.to,
    subject: interpolate(known.defaultSubject, vars),
    html: interpolate(fallbackHtml, vars),
    kind: 'daily_digest',
  });
}
