import { getResend, sendEmailWithRetry } from './resend';
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
 */
export async function sendMagicLink(
  to: string,
  token: string,
  code: string,
  returnTo?: string,
): Promise<void> {
  const params = new URLSearchParams({ token });
  if (returnTo) params.set('returnTo', returnTo);
  const url = `${env.APP_URL}/api/auth/verify?${params.toString()}`;

  // Code SEM espaço — per product feedback "ao copiar e colar
  // sempre fica faltando um número". O espaço entre os 3+3
  // dígitos quebrava o copy de duplo-clique (selecionava só
  // metade). A leitura humana é preservada pelo
  // letter-spacing CSS no template (`letter-spacing: 0.2em`).
  const codeFormatted = code;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 16px;">Seu acesso ao Fanverse</h1>
      <p style="font-size: 15px; line-height: 1.55; color: #333;">
        Clique no botão abaixo pra entrar. O link expira em 15 minutos e só pode ser usado uma vez.
      </p>
      <p style="margin: 28px 0;">
        <a href="${url}"
           style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 999px; font-weight: 600;">
          Entrar no Fanverse
        </a>
      </p>

      <div style="margin: 32px 0; padding: 20px; background: #f6f6f7; border-radius: 12px; text-align: center;">
        <p style="font-size: 13px; color: #666; margin: 0 0 8px;">
          Ou digite este código no app:
        </p>
        <p style="font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 28px; font-weight: 700; letter-spacing: 0.2em; color: #111; margin: 0;">
          ${codeFormatted}
        </p>
      </div>

      <p style="font-size: 13px; color: #888;">
        Se o botão não funcionar, copie e cole este link no navegador:<br/>
        <span style="word-break: break-all;">${url}</span>
      </p>
      <p style="font-size: 12px; color: #aaa; margin-top: 32px;">
        Se você não pediu este email, ignore.
      </p>
    </div>
  `;

  // Envio com timeout (8s) + retry exponencial em falha transiente.
  // Erros 4xx (email inválido, quota) não retentam.
  await sendEmailWithRetry(
    () =>
      getResend().emails.send({
        from: env.EMAIL_FROM,
        to,
        subject: 'Seu link de acesso ao Fanverse',
        html,
      }),
    { scope: 'auth.magic-link' },
  );
}
