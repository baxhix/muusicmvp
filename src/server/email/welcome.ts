/**
 * Email de boas-vindas — disparado UMA VEZ por usuário, logo após
 * o onboarding completar (POST /api/auth/onboarding).
 *
 * Idempotência: o caller só chama esta função se
 * `users.welcome_email_sent_at IS NULL`. Após enviar, o caller
 * grava o timestamp. Race conditions de network são absorvidas
 * pelo UPDATE ... WHERE welcome_email_sent_at IS NULL no caller
 * (atômico no Postgres).
 *
 * Mesmo pipeline do magicLink: lê template do DB com fallback
 * hardcoded + brand settings (logo no header + brand footer).
 */

import { sendEmail } from './resend';
import { getTemplate, interpolate, getKnownTemplate } from './templates';
import { getBrandSettings } from './brand';
import { designToHtml } from './design';
import { env } from '../env';
import { logger } from '../log';

export interface SendWelcomeEmailInput {
  to: string;
  userName: string;
}

export async function sendWelcomeEmail(
  input: SendWelcomeEmailInput,
): Promise<void> {
  const vars = {
    userName: input.userName,
    appUrl: `${env.APP_URL}/app`,
  };

  const [dbTemplate, brand] = await Promise.all([
    getTemplate('boas_vindas'),
    getBrandSettings(),
  ]);

  // 1ª: template editado no DB.
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
      kind: 'boas_vindas',
    });
    return;
  }

  // 2ª: fallback hardcoded.
  const known = getKnownTemplate('boas_vindas');
  if (!known) {
    logger.warn('email.welcome.no-template', { kind: 'boas_vindas' });
    return;
  }
  const fallbackHtml = known.defaultDesign
    ? designToHtml(known.defaultDesign, brand)
    : known.defaultHtml;
  await sendEmail({
    to: input.to,
    subject: interpolate(known.defaultSubject, vars),
    html: interpolate(fallbackHtml, vars),
    kind: 'boas_vindas',
  });
}
