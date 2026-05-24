import { sendEmail } from './resend';
import { getTemplate, interpolate, getKnownTemplate } from './templates';
import { env } from '../env';

/**
 * Send a magic-link email with BOTH the clickable link AND a
 * 6-digit OTP fallback code. Usuário pode:
 *   - clicar no botão "Entrar" → /api/auth/verify?token=...
 *   - copiar o código de 6 dígitos e colar em /auth/verify
 *
 * Ambos os métodos consomem o mesmo registro em `tokens` (single-
 * use, expira em 15min). `returnTo` quando presente cai no
 * subdomínio de origem após verify.
 *
 * Resolução do conteúdo:
 *   1. Tenta ler subject/html do registro `email_templates` no DB
 *      (kind='magic_link'). Quem edita pelo admin sobrescreve.
 *   2. Se não houver registro ativo, cai pro template hardcoded
 *      em `KNOWN_TEMPLATES`. Garante que desativar no DB não
 *      quebra login.
 *   3. Variáveis suportadas: {{magicUrl}} e {{code}}.
 *
 * O envio passa pelo `sendEmail` (resend.ts) que grava em
 * `email_logs` automaticamente — sucesso ou falha.
 */
export async function sendMagicLink(
  to: string,
  token: string,
  code: string,
  returnTo?: string,
): Promise<void> {
  const params = new URLSearchParams({ token });
  if (returnTo) params.set('returnTo', returnTo);
  const magicUrl = `${env.APP_URL}/api/auth/verify?${params.toString()}`;

  // Code SEM espaço — per product feedback "ao copiar e colar
  // sempre fica faltando um número". O espaço entre os 3+3
  // dígitos quebrava o copy de duplo-clique (selecionava só
  // metade). A leitura humana é preservada pelo
  // letter-spacing CSS no template (`letter-spacing: 0.2em`).
  const vars = { magicUrl, code };

  // 1ª tentativa: template editável no DB.
  const dbTemplate = await getTemplate('magic_link');
  if (dbTemplate) {
    await sendEmail({
      to,
      subject: interpolate(dbTemplate.subject, vars),
      html: interpolate(dbTemplate.html, vars),
      kind: 'magic_link',
    });
    return;
  }

  // 2ª: fallback hardcoded vindo de KNOWN_TEMPLATES.
  const known = getKnownTemplate('magic_link');
  if (!known) {
    // Sanity check — KNOWN_TEMPLATES sempre tem 'magic_link'.
    throw new Error('magic_link template not registered in KNOWN_TEMPLATES');
  }
  await sendEmail({
    to,
    subject: interpolate(known.defaultSubject, vars),
    html: interpolate(known.defaultHtml, vars),
    kind: 'magic_link',
  });
}
