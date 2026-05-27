/**
 * GET /r/[slug] — endpoint público de redirect pra artist signup
 * links. Espelha encurtadores tipo bit.ly mas resolve direto pro
 * /teste com tracking via cookie.
 *
 * Fluxo:
 *   1. Visitante clica em muusic.live/r/ana-castela (compartilhado
 *      por um artista nas redes).
 *   2. Este handler valida que o slug existe E não está arquivado.
 *      Se OK, seta cookie `fanverse_ref={slug}` (httpOnly off pra
 *      o auth flow no client conseguir consumir se necessário,
 *      mas o backend é quem usa de fato).
 *   3. Redirect 302 pra `/teste` (landing principal).
 *   4. Quando o user completa signup, o backend lê o cookie e
 *      grava users.signup_link_id (via resolveSlugForSignup).
 *
 * Slug arquivado ou inexistente → ainda redireciona pra /teste
 * mas SEM setar cookie (não atribui aquisição). Não retorna 404
 * pra evitar quebrar links antigos publicados em campanhas
 * passadas — o usuário ainda chega na landing.
 */

import { NextResponse } from 'next/server';
import { getArtistLinkBySlug } from '@/server/acquisition/links';

export const runtime = 'nodejs';

const COOKIE_NAME = 'fanverse_ref';
/* TTL de 30 dias — visitante pode descobrir o link, voltar
 * mais tarde via direct link, e ainda receber atribuição. */
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30;

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const normalized = slug.toLowerCase();

  const url = new URL(req.url);
  /* Redirect destino — sempre /teste (landing principal) por
   * default. Pode-se permitir ?to= pra futuras campanhas
   * apontando pra páginas específicas (ex: pre-save), mas é
   * MVP por enquanto. */
  const dest = new URL('/teste', url.origin);
  const response = NextResponse.redirect(dest, 302);

  /* Só seta o cookie se o link existir e não estiver
   * arquivado. Arquivados são tratados como inexistentes pro
   * propósito de captura — não recebem NOVOS signups. */
  try {
    const link = await getArtistLinkBySlug(normalized);
    if (link && !link.archivedAt) {
      response.cookies.set({
        name: COOKIE_NAME,
        value: normalized,
        maxAge: COOKIE_MAX_AGE_S,
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
      });
    }
  } catch {
    /* DB down ou exception — segue o redirect sem atribuição.
     * Preserva UX (usuário ainda chega na landing) e perdemos
     * só essa atribuição específica. */
  }

  return response;
}
