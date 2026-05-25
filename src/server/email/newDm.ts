/**
 * Email de "nova mensagem direta" — disparado pelo chat backend
 * (sendMessage) quando o destinatário está OFFLINE no momento do
 * envio (sem socket ativo via presence.ts).
 *
 * Por que existe: o canal in-app já gera notificação (sino + badge)
 * pra TODAS as DMs. Mas quando o user nem está com o app aberto,
 * essa notificação fica invisível até ele voltar. O email cobre
 * esse gap.
 *
 * Anti-spam: o caller deve gatear via `isNotificationEnabled('new_dm',
 * 'email')` (toggle do admin) E via `!isOnline(recipientId)` (estado
 * real). Sem esses dois, este helper não deve ser chamado.
 *
 * Coalescing/throttling de email NÃO é feito aqui — fica como TODO
 * na v2 (ex: max 1 email/conversa a cada 10 minutos). Por enquanto,
 * cada mensagem offline gera um email — aceitável pro MVP.
 *
 * Mesmo pipeline dos outros emails: template do DB (editável via
 * /admin/emails/templates/new_dm/edit) com fallback pro
 * KNOWN_TEMPLATES + brand settings.
 */

import { sendEmail } from './resend';
import { getTemplate, interpolate, getKnownTemplate } from './templates';
import { getBrandSettings } from './brand';
import { designToHtml } from './design';
import { env } from '../env';
import { logger } from '../log';

export interface SendNewDmEmailInput {
  /** Email do destinatário (quem vai receber o aviso). */
  to: string;
  /** Nome de quem mandou a mensagem (não o destinatário). */
  senderName: string;
  /** Trecho da mensagem (não a mensagem inteira pra preservar
   *  privacidade + caber no preview do inbox). Caller deve truncar
   *  antes de chamar. */
  messageSnippet: string;
  /** URL que abre a conversa específica no app. Caller monta
   *  ${APP_URL}/app/chat?conversation=${id} ou similar. */
  conversationUrl: string;
}

/** Trunca a mensagem pra preview, preservando palavras inteiras quando
 *  possível. Limite de 200 chars cobre 95% dos casos sem ficar
 *  comprido no inbox preview. Exportado pra que o caller possa pré-
 *  formatar se preferir. */
export function snippetOf(body: string, max = 200): string {
  const cleaned = body.trim();
  if (cleaned.length <= max) return cleaned;
  /* Quebra na palavra mais próxima de `max` pra não cortar no
   * meio de uma palavra. Adiciona "…" no fim pra sinalizar
   * truncamento. */
  const sliced = cleaned.slice(0, max);
  const lastSpace = sliced.lastIndexOf(' ');
  const safe = lastSpace > max * 0.6 ? sliced.slice(0, lastSpace) : sliced;
  return `${safe}…`;
}

export async function sendNewDmEmail(
  input: SendNewDmEmailInput,
): Promise<void> {
  const vars = {
    senderName: input.senderName,
    messageSnippet: input.messageSnippet,
    conversationUrl: input.conversationUrl,
  };

  const [dbTemplate, brand] = await Promise.all([
    getTemplate('new_dm'),
    getBrandSettings(),
  ]);

  // 1ª: template editado no admin.
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
      kind: 'new_dm',
    });
    return;
  }

  // 2ª: fallback hardcoded do catálogo.
  const known = getKnownTemplate('new_dm');
  if (!known) {
    logger.warn('email.new-dm.no-template', { kind: 'new_dm' });
    return;
  }
  const fallbackHtml = known.defaultDesign
    ? designToHtml(known.defaultDesign, brand)
    : known.defaultHtml;
  await sendEmail({
    to: input.to,
    subject: interpolate(known.defaultSubject, vars),
    html: interpolate(fallbackHtml, vars),
    kind: 'new_dm',
  });
}

/** Constrói a URL deep-link da conversa. Usada pelo caller pra
 *  evitar duplicar a montagem do path em vários lugares. */
export function buildConversationUrl(conversationId: string): string {
  const base = env.APP_URL.replace(/\/+$/, '');
  return `${base}/app/chat?conversation=${encodeURIComponent(conversationId)}`;
}
