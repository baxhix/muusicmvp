import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { markConversationRead, userIsInConversation } from '@/server/chat/queries';

export const runtime = 'nodejs';

const uuid = z.string().uuid();

/* Body opcional — quando passado `messageId`, o servidor pula o
 * SELECT pra descobrir a última mensagem (P1.6). O cliente sabe
 * porque acabou de receber via socket. Sem `messageId`, fallback
 * para a query antiga. */
const bodySchema = z
  .object({
    messageId: z.string().uuid().optional(),
  })
  .optional();

/**
 * Marks every message in the conversation as read for the calling user.
 * Atualiza `last_read_message_id` + zera `unread_count` denormalizado
 * (P0.2). Quando o body trouxer `messageId`, usa-o direto em vez de
 * varrer messages — economiza um ORDER BY + LIMIT 1 por chamada.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  // Body é optional — req sem body ainda funciona (caso legado).
  let messageId: string | undefined;
  try {
    const text = await req.text();
    if (text) {
      const parsed = bodySchema.safeParse(JSON.parse(text));
      if (parsed.success && parsed.data) {
        messageId = parsed.data.messageId;
      }
    }
  } catch {
    // body malformado: ignora e cai no fallback
  }

  const inIt = await userIsInConversation(user.id, id);
  if (!inIt) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  await markConversationRead(id, user.id, { messageId });
  return NextResponse.json({ ok: true });
}
