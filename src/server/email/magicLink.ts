import { sendEmail } from './resend';
import { getTemplate, interpolate, getKnownTemplate } from './templates';
import { getBrandSettings } from './brand';
import { designToHtml } from './design';
import { env } from '../env';

/**
 * Constrói a URL completa de verify a partir do token raw (não
 * hasheado, o mesmo que vai no email). `returnTo` é opcional —
 * quando presente, o verify redireciona pro subdomínio de origem
 * após criar a sessão. Exportado pra ser reusado em outros
 * disparos (ex: boas_vindas, que carrega o próprio magic link).
 */
export function buildMagicUrl(token: string, returnTo?: string): string {
  const params = new URLSearchParams({ token });
  if (returnTo) params.set('returnTo', returnTo);
  return `${env.APP_URL}/api/auth/verify?${params.toString()}`;
}

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
  const magicUrl = buildMagicUrl(token, returnTo);

  // Code SEM espaço — per product feedback "ao copiar e colar
  // sempre fica faltando um número". O espaço entre os 3+3
  // dígitos quebrava o copy de duplo-clique (selecionava só
  // metade). A leitura humana é preservada pelo
  // letter-spacing CSS no template (`letter-spacing: 0.2em`).
  const vars = { magicUrl, code };

  // Busca brand settings em paralelo com o template — ambos vão
  // pro renderer juntos. Cached 60s no módulo brand.ts.
  const [dbTemplate, brand] = await Promise.all([
    getTemplate('magic_link'),
    getBrandSettings(),
  ]);

  // 1ª tentativa: template editável no DB.
  if (dbTemplate) {
    // Se o template tem design salvo, regenera HTML COM brand
    // pra incluir logo + brand footer. Senão, usa o html cru
    // do DB + sufixa o brand footer manualmente.
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
      to,
      subject: interpolate(dbTemplate.subject, vars),
      html: interpolate(html, vars),
      kind: 'magic_link',
    });
    return;
  }

  // 2ª: fallback hardcoded vindo de KNOWN_TEMPLATES. Aqui também
  // tenta gerar via defaultDesign pra aplicar brand; se não houver,
  // usa o HTML hardcoded raso sem brand footer (cenário improvável
  // — todos os KNOWN_TEMPLATES têm defaultDesign).
  const known = getKnownTemplate('magic_link');
  if (!known) {
    throw new Error('magic_link template not registered in KNOWN_TEMPLATES');
  }
  const fallbackHtml = known.defaultDesign
    ? designToHtml(known.defaultDesign, brand)
    : known.defaultHtml;
  await sendEmail({
    to,
    subject: interpolate(known.defaultSubject, vars),
    html: interpolate(fallbackHtml, vars),
    kind: 'magic_link',
  });
}
