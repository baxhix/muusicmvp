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

/* Espelha `attachmentSchema` do socket handler em
 * server/realtime/handlers/chat.ts — mantemos duplicado pra evitar
 * import de zod schema entre módulos de surface diferentes. */
const restAttachmentSchema = z.object({
  url: z.string().startsWith('/api/chat/images/').max(300),
  mimeType: z.string().max(80),
  size: z.number().int().min(0).max(8 * 1024 * 1024),
  width: z.number().int().min(1).max(20_000).nullable().optional(),
  height: z.number().int().min(1).max(20_000).nullable().optional(),
});

const sendSchema = z.object({
  /* body pode ser vazio QUANDO houver attachments — o
   * sendMessage() valida "uma das duas" server-side. Aqui só
   * limite máximo. */
  body: z.string().max(4000),
  attachments: z.array(restAttachmentSchema).max(6).optional(),
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

  /* Proteção a menores: menor de idade não envia mensagem pra ninguém.
   * Checa cedo (evita o trabalho) — o sendMessage() tem o backstop. */
  if (user.isMinor) {
    return NextResponse.json({ error: 'minor_blocked' }, { status: 403 });
  }

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

  try {
    const result = await sendMessage(
      id,
      user.id,
      parsed.body,
      parsed.attachments ?? null,
    );
    return NextResponse.json({ message: result.message }, { status: 201 });
  } catch (err) {
    /* `empty_message` quando nem body nem attachments;
     * `attachments_*` quando o payload de anexo é inválido. Tudo
     * é erro do client → 400. */
    const code = err instanceof Error ? err.message : 'send_failed';
    // Backstop do sendMessage() pra menor de idade (caso o early-check
    // acima não pegue por algum motivo) → 403.
    if (code === 'minor_messaging_blocked') {
      return NextResponse.json({ error: 'minor_blocked' }, { status: 403 });
    }
    if (
      code === 'empty_message' ||
      code === 'message_too_long' ||
      code === 'attachments_invalid' ||
      code === 'attachments_too_many'
    ) {
      return NextResponse.json({ error: code }, { status: 400 });
    }
    throw err;
  }
}
