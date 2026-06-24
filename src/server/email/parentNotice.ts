/**
 * Aviso ao responsável — disparado UMA VEZ quando uma conta de
 * menor de idade (12–17) é finalizada no onboarding.
 *
 * Requisito de produto/LGPD: "o e-mail do responsável deve receber
 * um e-mail informando que o seu filho se cadastrou na plataforma
 * Fanverse Ana Castela".
 *
 * Best-effort: o caller (POST /api/auth/onboarding) NÃO bloqueia a
 * finalização da conta se o envio falhar — o aviso é importante mas
 * não pode travar o cadastro do menor. Erros são logados pelo
 * próprio sendEmail (email_logs) + caller.
 *
 * Email transacional simples (HTML inline) — não passa pelo catálogo
 * de templates editáveis do admin de propósito: é um aviso legal de
 * texto fixo, não uma peça de marketing.
 */

import { sendEmail } from './resend';
import { getBrandSettings } from './brand';

export interface SendParentSignupNoticeInput {
  /** E-mail do pai/mãe/responsável informado no onboarding. */
  to: string;
  /** Nome de exibição do menor (displayName). Pode ser vazio. */
  childName?: string | null;
}

export async function sendParentSignupNotice(
  input: SendParentSignupNoticeInput,
): Promise<void> {
  const child = (input.childName ?? '').trim() || 'seu filho(a)';
  const brand = await getBrandSettings();
  const logo = brand?.logoUrl ?? null;
  const platform = 'Fanverse Ana Castela';

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
  ${logo ? `<img src="${logo}" alt="${platform}" style="height: 32px; margin-bottom: 24px;" />` : ''}
  <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 16px;">
    ${child} criou uma conta no ${platform}
  </h1>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px; color: #333;">
    Você está recebendo este aviso porque foi indicado(a) como
    responsável por uma pessoa menor de idade que acabou de se
    cadastrar no <strong>${platform}</strong>, a comunidade oficial de fãs.
  </p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px; color: #333;">
    Para proteger menores de idade, a conta dele(a) tem regras
    reforçadas de privacidade: o sobrenome e o e-mail ficam ocultos
    para outras pessoas, a localização não é coletada, e o perfil não
    aparece em buscas, listagens públicas nem em sugestões para
    desconhecidos.
  </p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px; color: #333;">
    Se você não reconhece este cadastro ou deseja que a conta seja
    removida, responda este e-mail ou entre em contato com o nosso
    suporte.
  </p>
  <p style="font-size: 13px; line-height: 1.5; margin: 0; color: #888;">
    Este é um aviso automático do ${platform}.
  </p>
</div>`.trim();

  await sendEmail({
    to: input.to,
    subject: `${child} criou uma conta no ${platform}`,
    html,
    kind: 'parent_signup_notice',
    // Aviso legal — não pode pendurar o handler; usa o timeout padrão.
    retries: 1,
  });
}
