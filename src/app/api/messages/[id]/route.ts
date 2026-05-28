import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { deleteMessage } from '@/server/chat/messages';

export const runtime = 'nodejs';

const uuid = z.string().uuid();

/**
 * DELETE /api/messages/:id — soft-delete da mensagem.
 *
 * Regras de permissão centralizadas no `deleteMessage` (server/chat/messages.ts):
 *   - DM: cada participante só pode apagar a própria mensagem
 *   - Group: owner apaga qualquer; outros só a própria
 *   - System kinds ('system_created', 'system_join', 'deleted') → 400
 *
 * Side-effect: se a mensagem tinha attachments, os arquivos no disco são
 * unlink fire-and-forget (já tratado dentro do deleteMessage).
 *
 * NÃO emite broadcast por aqui — o broadcast cross-client roda pelo
 * socket handler `chat:delete` quando o caller usa a rota realtime. Esta
 * REST é o fallback (offline-resilient) e o consumidor é o próprio
 * cliente que disparou — o optimistic update local já cobre.
 *
 * Retorna 204 em sucesso (sem body, padrão REST pra delete).
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    await deleteMessage(id, user.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'delete_failed';
    /* Mapping 1-pra-1 dos throw do server. Mantém o front com
     * códigos previsíveis sem expor stack trace. */
    if (code === 'not_found') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (code === 'forbidden') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (code === 'not_deletable') {
      return NextResponse.json({ error: 'not_deletable' }, { status: 400 });
    }
    throw err;
  }
}
