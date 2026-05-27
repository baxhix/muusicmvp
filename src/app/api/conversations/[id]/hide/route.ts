import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { hideConversationForUser } from '@/server/chat/queries';

export const runtime = 'nodejs';

const uuid = z.string().uuid();

/**
 * POST /api/conversations/:id/hide
 *
 * "Apagar conversa pra mim" — soft-hide per-participant.
 *
 * Semântica importante:
 *   - A conversa SOMENTE some pra QUEM chamou esta rota. A outra
 *     parte continua vendo tudo intacto.
 *   - É registrado em `conversation_participants.hidden_at`. A
 *     próxima fetch da lista filtra a conversa fora.
 *   - DMs em que a outra pessoa MANDAR mensagem depois ressurgem
 *     (created_at > hidden_at) — comportamento estilo WhatsApp.
 *   - Idempotente: chamar de novo só atualiza hidden_at pra now()
 *     (efetivamente "limpa" mensagens novas que tinham ressuscitado
 *     a conversa).
 *
 * Retorna { ok: true } no sucesso, 403 se o user não é participante.
 */
export async function POST(
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

  const ok = await hideConversationForUser(id, user.id);
  if (!ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
