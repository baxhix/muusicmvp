/**
 * Email "movimentação nas suas comunidades" — disparado pelo cron
 * de interações em comunidades. Mostra APENAS os nomes das
 * comunidades (sem conteúdo) pra induzir curiosidade e fazer o
 * user voltar ver no app.
 *
 * Diferente dos outros emails, este recebe uma LISTA de
 * comunidades por usuário — o cron agrega antes de chamar este
 * helper, evitando 1 email por comunidade.
 */

import { sendEmail } from './resend';
import { getTemplate, interpolate, getKnownTemplate } from './templates';
import { getBrandSettings } from './brand';
import { designToHtml } from './design';
import { env } from '../env';
import { logger } from '../log';

export interface SendCommunityInteractionsInput {
  to: string;
  userName: string;
  /** Nomes das comunidades que tiveram movimentação. Caller
   *  garante: max 8 (acima vira "+ outras N") + dedup. */
  communityNames: string[];
}

export async function sendCommunityInteractionsEmail(
  input: SendCommunityInteractionsInput,
): Promise<void> {
  if (input.communityNames.length === 0) return;

  /* Renderiza a lista como bullets HTML. Truncar em 8 pra não
   * crescer demais — se passar, mostra "+N outras" no final. */
  const MAX_VISIBLE = 8;
  const visible = input.communityNames.slice(0, MAX_VISIBLE);
  const extra = input.communityNames.length - visible.length;
  const items = visible.map((n) => `• <b>${escapeHtml(n)}</b>`);
  if (extra > 0) {
    items.push(`<span style="color:#888;">+ ${extra} outras</span>`);
  }
  const communityList = items.join('<br/>');

  const vars = {
    userName: input.userName,
    communityList,
    appUrl: `${env.APP_URL.replace(/\/+$/, '')}/app`,
  };

  const [dbTemplate, brand] = await Promise.all([
    getTemplate('community_interactions'),
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
      kind: 'community_interactions',
    });
    return;
  }

  const known = getKnownTemplate('community_interactions');
  if (!known) {
    logger.warn('email.community-interactions.no-template');
    return;
  }
  const fallbackHtml = known.defaultDesign
    ? designToHtml(known.defaultDesign, brand)
    : known.defaultHtml;
  await sendEmail({
    to: input.to,
    subject: interpolate(known.defaultSubject, vars),
    html: interpolate(fallbackHtml, vars),
    kind: 'community_interactions',
  });
}

/** HTML escape mínimo pros nomes de comunidade — defesa contra
 *  edge cases tipo nome com "<script>". O `interpolate` usa
 *  substituição string-to-string sem escaping, então a defesa
 *  precisa estar aqui antes da concat. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
