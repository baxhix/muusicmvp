import { resend } from './resend';
import { env } from '../env';

export async function sendMagicLink(to: string, token: string): Promise<void> {
  const url = `${env.APP_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;

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

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Seu link de acesso ao muusic',
    html,
  });
}
