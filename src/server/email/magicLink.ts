import { getResend } from './resend';
import { env } from '../env';

/**
 * Send a magic-link email. `returnTo`, when present, is appended to the
 * verify URL so the user lands back on the origin that started the
 * login flow (e.g. admin.muusic.live or painel.muusic.live). The verify
 * route re-validates returnTo against an allowlist before redirecting,
 * so this is just a passthrough — no trust is implied here.
 */
export async function sendMagicLink(
  to: string,
  token: string,
  returnTo?: string,
): Promise<void> {
  const params = new URLSearchParams({ token });
  if (returnTo) params.set('returnTo', returnTo);
  const url = `${env.APP_URL}/api/auth/verify?${params.toString()}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 16px;">Seu acesso ao muusic</h1>
      <p style="font-size: 15px; line-height: 1.55; color: #333;">
        Clique no botão abaixo pra entrar. O link expira em 15 minutos e só pode ser usado uma vez.
      </p>
      <p style="margin: 28px 0;">
        <a href="${url}"
           style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 999px; font-weight: 600;">
          Entrar no muusic
        </a>
      </p>
      <p style="font-size: 13px; color: #888;">
        Se o botão não funcionar, copie e cole este link no navegador:<br/>
        <span style="word-break: break-all;">${url}</span>
      </p>
      <p style="font-size: 12px; color: #aaa; margin-top: 32px;">
        Se você não pediu este email, ignore.
      </p>
    </div>
  `;

  await getResend().emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Seu link de acesso ao muusic',
    html,
  });
}
