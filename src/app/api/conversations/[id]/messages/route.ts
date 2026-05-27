import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/server/auth/requireUser';
import { db } from '@/server/db';
import { conversations } from '@/server/db/schema';
import { listMessages, userIsInConversation } from '@/server/chat/queries';
import { sendMessage } from '@/server/chat/messages';

export const runtime = 'nodejs';

const querySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const sendSchema = z.object({
  body: z.string().min(1).max(4000),
});

const uuid = z.string().uuid();

async function checkAccess(
  conversationId: string,
  userId: string,
  opts: { requireActive?: boolean } = {},
) {
  if (!uuid.safeParse(conversationId).success) {
    return { error: NextResponse.json({ error: 'invalid_id' }, { status: 400 }) };
  }
  const inIt = await userIsInConversation(userId, conversationId, {
    requireActive: opts.requireActive,
  });
  if (!inIt) {
    /* Pra POST com requireActive=true, distinguimos "saiu do grupo"
     * de "nunca foi membro". Front usa esse erro pra mostrar o
     * banner "Você saiu do grupo e não pode mais enviar mensagens"
     * em vez de um forbidden genérico. */
    if (opts.requireActive) {
      const everInIt = await userIsInConversation(userId, conversationId);
      if (everInIt) {
        return {
          error: NextResponse.json(
            { error: 'left_conversation' },
            { status: 403 },
          ),
        };
      }
    }
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { error: null };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await ctx.params;
  const access = await checkAccess(id, user.id);
  if (access.error) return access.error;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    before: url.searchParams.get('before') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  /* P2.3: skip JOIN com `users` em DMs 1:1 — o cliente já tem o
   * otherUser hidratado na conversation summary, então o
   * senderName/email/avatar vindo da query é trabalho duplicado.
   * Grupos continuam com hydrateSender=true (default) porque o
   * front renderiza system messages compostas com o senderName. */
  const [conv] = await db
    .select({ type: conversations.type })
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  const isDm = conv?.type === 'dm';

  const { messages, hasMore } = await listMessages(id, {
    limit: parsed.data.limit,
    before: parsed.data.before ? new Date(parsed.data.before) : undefined,
    // Passing the viewer id hydrates each message with its aggregated
    // reactions (and the per-emoji `mine` flag) so the panel can
    // render reactions on initial load — was previously local-only
    // state that vanished when the user left and re-entered.
    viewerId: user.id,
    hydrateSender: !isDm,
  });

  return NextResponse.json({ messages, hasMore });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await ctx.params;
  /* POST exige membro ATIVO — usuários que SAÍRAM do grupo
   * (leftAt != null) recebem 403 com error='left_conversation'
   * pra que o front renderize o banner read-only. GET continua
   * permitindo leitura do histórico. */
  const access = await checkAccess(id, user.id, { requireActive: true });
  if (access.error) return access.error;

  let parsed;
  try {
    parsed = sendSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const result = await sendMessage(id, user.id, parsed.body);
  return NextResponse.json({ message: result.message }, { status: 201 });
}
