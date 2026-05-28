import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  conversationParticipants,
  conversations,
  messages,
  notifications,
  users,
  type Message,
} from '../db/schema';

/**
 * Conjunto de `kind`s que representam eventos de sistema (criação do
 * grupo, entrada de membro, etc.). Mensagens com qualquer destes kinds
 * NÃO podem ser apagadas — fazem parte do histórico imutável do
 * grupo. `kind='deleted'` também entra aqui pra deixar a delete
 * idempotente (tentar deletar uma mensagem já apagada vira no-op
 * silencioso em vez de erro). */
const NON_DELETABLE_KINDS = new Set(['system_created', 'system_join', 'deleted']);
import { isNotificationEnabled } from '../notifications/settings';
import {
  sendNewDmEmail,
  snippetOf,
  buildConversationUrl,
} from '../email/newDm';
import { logger } from '../log';
import { chatImageFilenameFromUrl, deleteChatImage } from './storage';

/**
 * Anexo (imagem) atrelado a uma mensagem. Persistido em
 * `messages.attachments` JSONB (migration 0046). Aqui só normalizamos
 * a validação no caminho de envio — o upload em si vive em
 * `src/server/chat/storage.ts` (`saveChatImage`).
 */
export interface MessageAttachment {
  url: string;
  mimeType: string;
  size: number;
  width?: number | null;
  height?: number | null;
}

/** Limite de anexos por mensagem. 6 cobre o caso "compartilhe esses
 *  prints" sem permitir spam de 50 imagens num único bubble. */
const MAX_ATTACHMENTS = 6;

/**
 * Message enriched with the sender's display name + avatar. Used by both
 * REST and Socket.IO emits so multi-user rooms (Superchat) can render the
 * sender's identity next to every bubble without per-message lookups.
 */
export interface HydratedMessage extends Message {
  senderName: string | null;
  senderEmail: string | null;
  senderAvatarUrl: string | null;
  attachments: MessageAttachment[] | null;
}

export interface SendMessageResult {
  message: HydratedMessage;
  /** Other participants of the conversation (excluding the sender). */
  recipientIds: string[];
  /** 'dm' | 'group' — caller decides whether to fan-out to user rooms. */
  conversationType: 'dm' | 'group';
  /** Subset of recipientIds that were @-mentioned in the body (group
   *  conversations only — always empty for DMs since mentions are
   *  redundant in 1:1 threads). Drives the realtime notify:new push
   *  in the socket handler. */
  mentionedUserIds: string[];
}

/**
 * Insert a message and create `message` notifications for every other
 * participant — but only for DMs. Group rooms (Superchat) skip notifications
 * to avoid the 1000x fan-out per message; the realtime channel covers them.
 *
 * Returns the message + the recipientIds so the caller (Socket.IO handler)
 * can emit per-user pokes to participants who aren't currently joined to
 * the conversation room.
 *
 * Caller must have already verified the sender is a participant.
 */
/** Pull every @[Display](uuid) token out of the body. Lifted to
 *  the server so the notification fan-out doesn't have to trust
 *  the client to pass the mentioned ids — we parse them ourselves
 *  from the canonical body format the client produced. */
const SERVER_MENTION_REGEX = /@\[[^\]]+\]\(([0-9a-f-]{36})\)/g;
function parseMentions(body: string): string[] {
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  // RegExp objects are stateful with /g; reset each call.
  const re = new RegExp(SERVER_MENTION_REGEX.source, 'g');
  while ((m = re.exec(body)) !== null) ids.push(m[1]);
  return Array.from(new Set(ids));
}

/**
 * Sanitiza + valida o array de attachments recebido do client.
 *
 *   - Hard cap em MAX_ATTACHMENTS (defense em profundidade — o
 *     composer já limita).
 *   - Cada item precisa de url + mimeType + size; campos
 *     desconhecidos são strippados pra não vazar pro JSONB.
 *   - URL precisa começar com `/api/chat/images/` — defesa
 *     contra ataque tipo "anexa URL externa pra exfiltrar IP"
 *     OU "anexa URL absoluta forjada". O upload é o único caminho
 *     legítimo de produzir URLs assim.
 */
function normalizeAttachments(
  input: unknown,
): MessageAttachment[] | null {
  if (input === null || input === undefined) return null;
  if (!Array.isArray(input)) throw new Error('attachments_invalid');
  if (input.length === 0) return null;
  if (input.length > MAX_ATTACHMENTS) throw new Error('attachments_too_many');
  const out: MessageAttachment[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') {
      throw new Error('attachments_invalid');
    }
    const r = raw as Record<string, unknown>;
    if (typeof r.url !== 'string' || !r.url.startsWith('/api/chat/images/')) {
      throw new Error('attachments_invalid');
    }
    if (typeof r.mimeType !== 'string') throw new Error('attachments_invalid');
    if (typeof r.size !== 'number' || r.size < 0) {
      throw new Error('attachments_invalid');
    }
    const w = typeof r.width === 'number' ? r.width : null;
    const h = typeof r.height === 'number' ? r.height : null;
    out.push({
      url: r.url,
      mimeType: r.mimeType,
      size: r.size,
      width: w,
      height: h,
    });
  }
  return out;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  /* Opcional pra preservar compat — chamadas existentes sem
   * anexos não precisam mudar. Quando vem definido, passa pela
   * validação de `normalizeAttachments`. */
  attachments?: MessageAttachment[] | null,
): Promise<SendMessageResult> {
  const trimmed = body.trim();
  const normalizedAttachments = normalizeAttachments(attachments);
  /* `empty_message` agora aceita mensagem sem texto SE houver
   * pelo menos um anexo — "envia só a imagem" é fluxo válido.
   * Limite de length continua se cobrindo. */
  if (!trimmed && !normalizedAttachments) throw new Error('empty_message');
  if (trimmed.length > 4000) throw new Error('message_too_long');

  const txResult = await db.transaction(async (tx) => {
    const [msg] = await tx
      .insert(messages)
      .values({
        conversationId,
        senderId,
        body: trimmed,
        attachments: normalizedAttachments,
      })
      .returning();

    const [conv] = await tx
      .select({ type: conversations.type })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    // Always fetch the other participants so the caller can broadcast to
    // their personal user rooms (covers users who haven't opened the
    // conversation room yet).
    //
    // Filtra quem SAIU do grupo (leftAt != null) — usuários inativos
    // não devem receber notif, nem ter unread incrementado, nem
    // figurar no fan-out de email/socket.
    const others = await tx
      .select({ userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          ne(conversationParticipants.userId, senderId),
          isNull(conversationParticipants.leftAt),
        ),
      );

    /* P0.2: denormaliza last_message_* na conversa + incrementa
     * unread_count pra cada outro participante ativo. Tudo na MESMA
     * tx pra que listConversationsForUser (que agora lê esses
     * counters direto, sem subqueries) seja sempre consistente.
     *
     * sql template é o caminho oficial do drizzle pra UPDATE com
     * expressão (incrementar um counter). */
    await tx
      .update(conversations)
      .set({
        lastMessageAt: msg.createdAt,
        lastMessageId: msg.id,
      })
      .where(eq(conversations.id, conversationId));

    if (others.length > 0) {
      await tx
        .update(conversationParticipants)
        .set({
          unreadCount: sql`${conversationParticipants.unreadCount} + 1`,
        })
        .where(
          and(
            eq(conversationParticipants.conversationId, conversationId),
            ne(conversationParticipants.userId, senderId),
            isNull(conversationParticipants.leftAt),
          ),
        );
    }

    // Notifications only for DMs; groups rely on realtime + unread-count via
    // last_read_message_id.
    if (conv?.type === 'dm' && others.length) {
      await tx.insert(notifications).values(
        others.map((p) => ({
          userId: p.userId,
          kind: 'message' as const,
          sourceUserId: senderId,
          conversationId,
          messageId: msg.id,
        })),
      );
    }

    // Mention notifications — fire ONLY in groups (DMs are 1:1, so
    // a generic 'message' notification is already enough). Filter
    // mentioned ids against the actual participant set so an
    // injected/stale @[…] in the body can't notify random users.
    let validMentions: string[] = [];
    if (conv?.type === 'group') {
      const mentioned = parseMentions(trimmed);
      const validIds = new Set(others.map((o) => o.userId));
      validMentions = mentioned.filter(
        (id) => id !== senderId && validIds.has(id),
      );
      if (validMentions.length > 0) {
        await tx.insert(notifications).values(
          validMentions.map((userId) => ({
            userId,
            kind: 'mention' as const,
            sourceUserId: senderId,
            conversationId,
            messageId: msg.id,
          })),
        );
      }
    }

    return { msg, others, conv, validMentions };
  });

  // Hydrate the sender once for the realtime emit + REST response. Outside
  // the transaction so the row-level locks release as soon as the insert
  // commits.
  const [sender] = await db
    .select({
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, senderId))
    .limit(1);

  /* Email pra TODA DM — separa-se em fire-and-forget aqui FORA da
   * transação. O in-app já foi notificado dentro do tx (campo
   * notifications). O email é mais um canal redundante (não
   * importa se o destinatário está online ou não).
   *
   * Guard chain (todos têm que passar):
   *   - É DM (group rooms confiam no realtime + unread count)
   *   - Tem destinatários
   *   - Notificação `new_dm` habilitada pelo admin no canal email
   *
   * Anti-spam de email NÃO é feito aqui — fica como TODO v2
   * (ex: max 1 email/conversa a cada 10min). Por enquanto, cada
   * mensagem em DM gera 1 email pra cada destinatário. Snippet é
   * truncado em 200 chars pra caber no preview do inbox. */
  if (txResult.conv?.type === 'dm' && txResult.others.length > 0) {
    void dispatchNewDmEmails({
      conversationId,
      senderName:
        sender?.name ?? sender?.email?.split('@')[0] ?? 'Alguém',
      messageBody: trimmed,
      recipientUserIds: txResult.others.map((p) => p.userId),
    });
  }

  return {
    message: {
      ...txResult.msg,
      senderName: sender?.name ?? null,
      senderEmail: sender?.email ?? null,
      senderAvatarUrl: sender?.avatarUrl ?? null,
      /* Normaliza pra `null` quando o array é vazio — economiza
       * bytes no payload do socket e simplifica o check no
       * front-end (`if (attachments) {...}` em vez de `length>0`). */
      attachments: normalizedAttachments,
    },
    recipientIds: txResult.others.map((p) => p.userId),
    conversationType: (txResult.conv?.type ?? 'dm') as 'dm' | 'group',
    mentionedUserIds: txResult.validMentions,
  };
}

/**
 * Soft-delete de uma mensagem. NÃO remove a row do banco — limpa o
 * body e troca o `kind` pra 'deleted' pra que o frontend renderize
 * uma pílula cinza "Mensagem apagada" no lugar da bolha.
 *
 * Regras de permissão:
 *   - O actor TEM que ser participante da conversa.
 *   - System kinds ('system_created' / 'system_join') NÃO podem ser
 *     apagados — fazem parte do histórico imutável do grupo.
 *   - Em DM: cada participante só pode apagar a PRÓPRIA mensagem.
 *   - Em GROUP:
 *       - Owner pode apagar QUALQUER mensagem (de qualquer membro).
 *       - Membros / admins só podem apagar a PRÓPRIA mensagem.
 *
 * Throws com `Error('not_found' | 'forbidden' | 'not_deletable')`
 * pra que a route HTTP mapeie pra 404 / 403 / 400.
 */
export async function deleteMessage(
  messageId: string,
  actorUserId: string,
): Promise<void> {
  const [row] = await db
    .select({
      messageId: messages.id,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      kind: messages.kind,
      attachments: messages.attachments,
      convType: conversations.type,
      convCreatedBy: conversations.createdBy,
      actorRole: conversationParticipants.role,
    })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .leftJoin(
      conversationParticipants,
      and(
        eq(conversationParticipants.conversationId, messages.conversationId),
        eq(conversationParticipants.userId, actorUserId),
      ),
    )
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!row) throw new Error('not_found');
  if (row.actorRole === null) throw new Error('forbidden');
  if (NON_DELETABLE_KINDS.has(row.kind)) throw new Error('not_deletable');

  const isOwn = row.senderId === actorUserId;
  const isGroupOwner =
    row.convType === 'group' && row.convCreatedBy === actorUserId;

  if (!isOwn && !isGroupOwner) throw new Error('forbidden');

  /* Soft-delete: limpa body, troca kind, E zera attachments. O
   * frontend não precisa mais saber dos anexos da mensagem
   * apagada (pílula "Mensagem apagada" cobre o slot). */
  await db
    .update(messages)
    .set({ body: '', kind: 'deleted', attachments: null })
    .where(eq(messages.id, messageId));

  /* Storage cleanup — unlink fire-and-forget dos arquivos que
   * estavam atrelados. Faz best-effort: se o disco der erro o
   * delete da mensagem em si já foi commitado (idempotente).
   * `chatImageFilenameFromUrl` valida o pattern do URL antes de
   * permitir o unlink, defendendo contra payloads forjados. */
  if (Array.isArray(row.attachments)) {
    void Promise.all(
      row.attachments
        .map((a) => {
          if (!a || typeof a !== 'object') return null;
          const url = (a as { url?: unknown }).url;
          return typeof url === 'string' ? url : null;
        })
        .map(async (url) => {
          if (!url) return;
          const fname = chatImageFilenameFromUrl(url);
          if (!fname) return;
          await deleteChatImage(fname);
        }),
    ).catch((err) => logger.error('chat.delete.unlink', err));
  }
}

/**
 * Para cada destinatário de uma DM, fire-and-forget o email de
 * "nova mensagem" — independente do estado online. Não joga exceção;
 * falhas são só logadas (Resend down não deve quebrar o envio da
 * mensagem em si).
 *
 * Antes esta função filtrava por `!isOnline(id)` (só offline). Per
 * product feedback, agora dispara pra todo destinatário — email é
 * canal redundante além do in-app, não substituto. Admin pode
 * desligar o canal email do `new_dm` no /notificacoes/new_dm pra
 * voltar ao comportamento antigo.
 */
async function dispatchNewDmEmails(params: {
  conversationId: string;
  senderName: string;
  messageBody: string;
  recipientUserIds: string[];
}): Promise<void> {
  try {
    if (params.recipientUserIds.length === 0) return;

    /* Gate pelo toggle do admin. Se o canal email do `new_dm`
     * estiver desligado, nem busca os emails (economiza query). */
    const emailEnabled = await isNotificationEnabled('new_dm', 'email');
    if (!emailEnabled) return;

    /* SINGLE QUERY pra puxar todos os destinatários (P0.4 da
     * auditoria de chat). O loop anterior fazia N SELECTs com
     * .limit(1) — comportamento OK pra DM 1:1, mas se a função
     * for chamada em group fan-out futuro vai vergar o pool.
     *
     * Mantém o filtro de soft-deleted no WHERE (deletedAt IS NULL)
     * direto no SQL — antes filtrava em JS depois do return. */
    const valid = await db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users)
      .where(
        and(
          inArray(users.id, params.recipientUserIds),
          isNull(users.deletedAt),
        ),
      );

    if (valid.length === 0) return;

    const snippet = snippetOf(params.messageBody);
    const conversationUrl = buildConversationUrl(params.conversationId);

    /* Dispara em paralelo — Resend aguenta. Falhas individuais não
     * afetam outras (Promise.allSettled). */
    const results = await Promise.allSettled(
      valid.map((r) =>
        sendNewDmEmail({
          to: r.email,
          senderName: params.senderName,
          messageSnippet: snippet,
          conversationUrl,
        }),
      ),
    );

    /* Loga só as falhas — sucessos já são gravados no email_logs
     * pelo `sendEmail` em si. */
    results.forEach((res, i) => {
      if (res.status === 'rejected') {
        logger.error('chat.new-dm.email-failed', res.reason, {
          recipientId: valid[i]?.id,
        });
      }
    });
  } catch (err) {
    /* Qualquer erro fora dos casos individuais (DB caiu, etc) —
     * só loga. O envio da mensagem em si continua. */
    logger.error('chat.new-dm.dispatch-failed', err, {
      conversationId: params.conversationId,
    });
  }
}
