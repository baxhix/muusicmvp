import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireUser } from '@/server/auth/requireUser';
import { softDeleteUser } from '@/server/users/softDelete';
import { SESSION_COOKIE } from '@/server/auth/session';
import { env } from '@/server/env';
import { handleApiError } from '@/server/api/errors';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * DELETE /api/me — soft-delete da conta do usuário autenticado.
 *
 * Direito à exclusão (LGPD art. 18). Não DELETE hard imediato —
 * mantemos a row marcada com `deleted_at`. Cron job futuro
 * anonimiza PII após período de retenção legal e faz o hard
 * delete final.
 *
 * Side effects (ver softDeleteUser):
 *   - Todas as sessões ativas são revogadas (force logout em
 *     todos os devices).
 *   - Cookie corrente é zerado pra o browser não tentar usar
 *     a sessão fantasma.
 *
 * Operação idempotente: chamar de novo retorna 200 sem efeito.
 */
export async function DELETE(_req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  try {
    const result = await softDeleteUser(user.id);

    logger.info('user.soft-delete', {
      userId: user.id,
      sessionsRevoked: result.sessionsRevoked,
      alreadyDeleted: !result.marked,
    });

    // Zera o cookie corrente. Mesmo se a sessão já foi deletada
    // do DB acima, o browser ainda tem o cookie até expirar — o
    // user veria erros 401 em vez de UX limpa.
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
      ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, {
      scope: 'me.delete',
      ctx: { userId: user.id },
    });
  }
}
