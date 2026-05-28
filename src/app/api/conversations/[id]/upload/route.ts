import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/server/db';
import { conversationParticipants } from '@/server/db/schema';
import { requireUser } from '@/server/auth/requireUser';
import { saveChatImage } from '@/server/chat/storage';
import { limitByIp, uploadLimiter } from '@/server/rateLimit';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * POST /api/conversations/:id/upload
 *
 * Upload de imagem pra ser anexada a uma mensagem na conversa.
 *
 *   - Body: multipart/form-data, campo `file`.
 *   - Auth: `requireUser()` + membership check — só quem está
 *     em `conversation_participants` (e não saiu, `leftAt IS NULL`)
 *     pode subir imagem pra aquela conversa.
 *   - Limits: 8 MB, image/jpeg|png|webp|gif. Validados no
 *     `saveChatImage()` e mapeados pra HTTP code apropriado.
 *
 * Não cria nenhuma mensagem — só persiste o arquivo + retorna
 * metadados. O client junta esse `{url, mimeType, ...}` no
 * payload do `chat:send` (socket) ou do POST de criar mensagem.
 *
 * Fluxo:
 *   1. user clica paperclip no composer
 *   2. client POST aqui → recebe {url, mimeType, size, width, height}
 *   3. client guarda na lista de attachments pendentes (preview)
 *   4. ao clicar enviar, client manda `chat:send` com body +
 *      attachments[]
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  /* Rate limit: token bucket 20 burst, 6/min — mesmo do avatar
   * upload. Anti-abuse de disco/banda. */
  const rl = limitByIp(req, uploadLimiter, 'chat-image-upload');
  if (!rl.ok) return rl.response;

  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id: conversationId } = await params;
  if (!UUID_REGEX.test(conversationId)) {
    return NextResponse.json({ error: 'invalid_conversation_id' }, { status: 400 });
  }

  /* Membership check — leftJoin do conv_participants e bloqueia
   * caso (a) user nunca foi membro, ou (b) user saiu (leftAt
   * non-null). Pra grupos, isso impede ex-membro de continuar
   * subindo arquivos. Pra DMs, ambos os participantes têm row
   * permanente. */
  const [membership] = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, user.id),
        isNull(conversationParticipants.leftAt),
      ),
    )
    .limit(1);
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no_file' }, { status: 400 });
  }

  try {
    const result = await saveChatImage(conversationId, file);
    return NextResponse.json({
      url: result.url,
      mimeType: result.mimeType,
      size: result.size,
      width: result.width,
      height: result.height,
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'write_failed';
    const status =
      code === 'too_large' ? 413 :
      code === 'unsupported_type' ? 415 :
      code === 'no_file' ? 400 :
      500;
    if (status === 500) logger.error('chat.upload.write', err);
    return NextResponse.json({ error: code }, { status });
  }
}
