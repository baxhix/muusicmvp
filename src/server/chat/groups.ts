import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  conversationParticipants,
  conversations,
  messages,
  notifications,
  users,
} from '../db/schema';

/**
 * Fallback canônico aplicado quando um grupo é criado sem nome.
 * Exposto pra que clientes possam exibir a mesma string em estados
 * otimistas (ex: optimistic insert na lista de conversas antes do
 * round-trip terminar). NÃO traduzir aqui — é a string de banco.
 */
export const DEFAULT_GROUP_NAME = 'Grupo sem nome';

/**
 * Build a new user-created group conversation in a single transaction.
 *
 * Inserts the conversation row (type='group', name, image_url,
 * created_by=ownerId), then bulk-inserts conversation_participants
 * rows — the owner gets role='owner', everyone else 'member'.
 *
 * Returns the new conversation id. The caller is expected to have
 * pre-validated:
 *   - all `memberIds` correspond to real users
 *   - the caller themselves is included in the final member set
 *     (we add them defensively here even if not, just to be safe).
 */
export async function createGroup(args: {
  ownerId: string;
  name: string;
  imageUrl: string | null;
  memberIds: string[];
}): Promise<{ id: string }> {
  /* Per product feedback "ao adicionar pessoas sem ter colocado o
   * nome do grupo, permita que o grupo seja criado com o nome
   * 'Grupo sem nome' e depois o usuário edita". Vazio NÃO joga
   * mais — vira o fallback canônico. Comprimento > 80 ainda
   * estoura porque cabe num UI limit razoável.
   *
   * Reutilizamos a constante DEFAULT_GROUP_NAME (exportada) pra
   * que clientes possam reaproveitar a mesma string ao renderizar
   * estados otimistas antes do round-trip. */
  const trimmedName = args.name.trim() || DEFAULT_GROUP_NAME;
  if (trimmedName.length > 80) {
    throw new Error('name_too_long');
  }

  // Always include the owner in the final participants set, even
  // if the caller forgot to. Dedupe + drop the owner's id from the
  // "other members" list since the owner gets a different role.
  const otherMemberIds = Array.from(
    new Set(args.memberIds.filter((id) => id !== args.ownerId)),
  );
  if (otherMemberIds.length === 0) {
    // A group needs at least the owner + one other member.
    throw new Error('not_enough_members');
  }

  // Verify all the proposed members exist. One query, then a
  // set-diff so we surface "user_not_found" precisely.
  const found = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, otherMemberIds));
  if (found.length !== otherMemberIds.length) {
    throw new Error('user_not_found');
  }

  return db.transaction(async (tx) => {
    const [conv] = await tx
      .insert(conversations)
      .values({
        type: 'group',
        name: trimmedName,
        imageUrl: args.imageUrl,
        createdBy: args.ownerId,
        /* P0.2: já inicializa member_count com o total final
         * (owner + N outros). Mantém consistência sem precisar
         * de UPDATE separado após o INSERT dos participants. */
        memberCount: 1 + otherMemberIds.length,
      })
      .returning({ id: conversations.id });

    await tx.insert(conversationParticipants).values([
      { conversationId: conv.id, userId: args.ownerId, role: 'owner' },
      ...otherMemberIds.map((userId) => ({
        conversationId: conv.id,
        userId,
        role: 'member' as const,
      })),
    ]);

    // System events na timeline — uma "badge" inicial pra cada
    // membro do grupo recém-criado. O owner ganha kind='system_created'
    // ("X criou o grupo") e cada outro membro ganha kind='system_join'
    // ("Y entrou"). Inserimos DENTRO da tx pra que, se a criação do
    // grupo falhar, esses eventos não fiquem órfãos.
    //
    // body é a string canônica em PT-BR pra que a row faça sentido
    // sozinha em dumps do banco; o front decide se renderiza usando
    // o body bruto ou compõe a partir do senderName + kind.
    await tx.insert(messages).values([
      {
        conversationId: conv.id,
        senderId: args.ownerId,
        body: 'criou o grupo',
        kind: 'system_created',
      },
      ...otherMemberIds.map((userId) => ({
        conversationId: conv.id,
        senderId: userId,
        body: 'entrou no grupo',
        kind: 'system_join',
      })),
    ]);

    // Notify every newly-added member (everyone EXCEPT the owner)
    // that they were added to a group. The user's notification list
    // (poll via /api/notifications, the NotificationBell renders it)
    // will pick this up on next refresh.
    await tx.insert(notifications).values(
      otherMemberIds.map((userId) => ({
        userId,
        kind: 'group_added' as const,
        sourceUserId: args.ownerId,
        conversationId: conv.id,
        // Stash the group name so the bell can render it without a
        // join when the group is later renamed/deleted.
        payload: { groupName: trimmedName },
      })),
    );

    return { id: conv.id };
  });
}

/** Update name + image of a group. Owner/admin only — caller enforces. */
export async function updateGroup(
  conversationId: string,
  patch: { name?: string; imageUrl?: string | null },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error('empty_name');
    if (trimmed.length > 80) throw new Error('name_too_long');
    update.name = trimmed;
  }
  if (patch.imageUrl !== undefined) update.imageUrl = patch.imageUrl;
  if (Object.keys(update).length === 0) return;

  await db
    .update(conversations)
    .set(update)
    .where(eq(conversations.id, conversationId));
}

/** Add a single user to a group as a 'member'. Lida com 3 estados:
 *
 *  1. user nunca foi membro    → INSERT (system_join + notif)
 *  2. user é membro ativo      → no-op (idempotente)
 *  3. user saiu antes (leftAt) → UPDATE leftAt=NULL (re-entry +
 *     system_join + notif — re-entrada conta como novo evento
 *     na timeline pros outros membros).
 *
 *  Quando `actorId` é passado E houve um evento real (insert OU
 *  re-entry), grava notification 'group_added' pro user adicionado. */
export async function addMember(
  conversationId: string,
  userId: string,
  actorId?: string,
): Promise<void> {
  /* Em vez de upsert+setWhere (que não roda confiável em todas as
   * versões do drizzle), splittamos em SELECT → INSERT/UPDATE.
   * 3 caminhos:
   *   - row inexistente   → INSERT novo participant
   *   - row com leftAt    → UPDATE leftAt = NULL (re-entry)
   *   - row ativa         → no-op
   * Em "ativa" retornamos cedo pra evitar system_join duplicado.
   *
   * Race-window pequena entre o SELECT e o INSERT é mitigada por
   * ON CONFLICT DO NOTHING no INSERT — se outra request inseriu
   * primeiro, esta vira no-op. */
  const [existing] = await db
    .select({
      userId: conversationParticipants.userId,
      leftAt: conversationParticipants.leftAt,
    })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);

  if (existing && !existing.leftAt) {
    // Membro ativo de novo (add idempotente) — nada a fazer.
    return;
  }

  /* INSERT/UPDATE do participant + bump do memberCount + system msg
   * em UMA tx. Antes ficava espalhado em 2 awaits separados — se
   * o primeiro commit acontecesse e o segundo falhasse, o contador
   * ficava desincronizado.
   *
   * Wrappar tudo no `db.transaction` resolve a atomicidade. */
  await db.transaction(async (tx) => {
    if (existing && existing.leftAt) {
      // Re-entry: zera leftAt + atualiza joinedAt + zera unreadCount
      // (o user volta como "lido tudo" — a system message own dele
      // serve de marco).
      await tx
        .update(conversationParticipants)
        .set({ leftAt: null, joinedAt: new Date(), unreadCount: 0 })
        .where(
          and(
            eq(conversationParticipants.conversationId, conversationId),
            eq(conversationParticipants.userId, userId),
          ),
        );
    } else {
      // Inserção normal pra quem nunca foi membro.
      const inserted = await tx
        .insert(conversationParticipants)
        .values({ conversationId, userId, role: 'member' })
        .onConflictDoNothing()
        .returning({ userId: conversationParticipants.userId });
      // Race: alguém mais rápido inseriu primeiro. Sai cedo do tx
      // SEM emitir system event ou bump no counter — outro fluxo já
      // fez isso.
      if (inserted.length === 0) {
        return;
      }
    }

    // Bump de memberCount (P0.2). Tanto INSERT novo quanto re-entry
    // contam — ambos tornam o user ativo de novo.
    await tx
      .update(conversations)
      .set({ memberCount: sql`${conversations.memberCount} + 1` })
      .where(eq(conversations.id, conversationId));

    // Timeline badge: "{userName} entrou no grupo".
    await tx.insert(messages).values({
      conversationId,
      senderId: userId,
      body: 'entrou no grupo',
      kind: 'system_join',
    });
  });

  if (!actorId) return;

  // Fetch the group name for the payload — saves the bell a join.
  const [conv] = await db
    .select({ name: conversations.name })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  await db.insert(notifications).values({
    userId,
    kind: 'group_added',
    sourceUserId: actorId,
    conversationId,
    payload: { groupName: conv?.name ?? 'um grupo' },
  });
}

/** "Sair do grupo" ou "kick".
 *
 *  Em vez de DELETE do row, marcamos `leftAt = now()`. Mantém o
 *  user como participant pra que ele AINDA enxergue o histórico
 *  do grupo em modo read-only (a UI bloqueia o composer), mas a
 *  rota POST de mensagens recusa porque cheka `leftAt IS NULL`.
 *  Isso permite a UX pedida: "Você saiu do grupo e não pode mais
 *  enviar mensagens".
 *
 *  Idempotente: chamar de novo num user já saído não regrava
 *  system_leave nem recadastra leftAt.
 *
 *  Em DMs, system events ficariam estranhos ("X saiu do grupo"
 *  sem grupo) — então pra DMs ainda fazemos hard-delete do row
 *  (uso real desta função em DMs é zero hoje, mas a guarda fica
 *  pro futuro). */
export async function removeMember(
  conversationId: string,
  userId: string,
): Promise<void> {
  const [participant] = await db
    .select({
      userId: conversationParticipants.userId,
      leftAt: conversationParticipants.leftAt,
    })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);
  if (!participant) return;
  // Já saiu — nada a fazer (idempotente).
  if (participant.leftAt) return;

  const [conv] = await db
    .select({ type: conversations.type })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  await db.transaction(async (tx) => {
    if (conv?.type === 'group') {
      // Badge "X saiu do grupo" no histórico do grupo. Frontend
      // resolve "Você saiu" pro próprio user (compara senderId
      // com o user logado).
      await tx.insert(messages).values({
        conversationId,
        senderId: userId,
        body: 'saiu do grupo',
        kind: 'system_leave',
      });
      // Soft-leave: row persiste com leftAt setado. Re-add via
      // addMember zera leftAt de volta.
      await tx
        .update(conversationParticipants)
        .set({ leftAt: new Date() })
        .where(
          and(
            eq(conversationParticipants.conversationId, conversationId),
            eq(conversationParticipants.userId, userId),
          ),
        );
      // Decrementa memberCount (P0.2). GREATEST evita valores
      // negativos em caso de drift (defensivo).
      await tx
        .update(conversations)
        .set({
          memberCount: sql`GREATEST(${conversations.memberCount} - 1, 0)`,
        })
        .where(eq(conversations.id, conversationId));
    } else {
      // DM: comportamento legado (hard-delete).
      await tx
        .delete(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.conversationId, conversationId),
            eq(conversationParticipants.userId, userId),
          ),
        );
    }
  });
}

/** Hard-delete a group + cascade-delete its messages/reactions/etc.
 *  Owner only. Caller enforces. */
export async function deleteGroup(conversationId: string): Promise<void> {
  await db.delete(conversations).where(eq(conversations.id, conversationId));
}

/** Look up the caller's role inside a conversation. Returns null
 *  when the user isn't a participant. */
export async function getUserRole(
  conversationId: string,
  userId: string,
): Promise<'owner' | 'admin' | 'member' | null> {
  const rows = await db
    .select({ role: conversationParticipants.role })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);
  return (rows[0]?.role as 'owner' | 'admin' | 'member' | undefined) ?? null;
}

/** List the ATIVOS participants of a group — name + avatar + role
 *  for each. Filtra quem saiu (`left_at IS NOT NULL`) — eles não
 *  aparecem mais no roster, mesmo que a row ainda exista pra
 *  preservar histórico. Usado pela "Membros" panel + autocomplete
 *  de @mentions (não faz sentido mencionar quem saiu). */
export async function listMembers(conversationId: string) {
  const rows = await db.execute(sql`
    SELECT
      u.id, u.name, u.email, u.avatar_url, cp.role, cp.joined_at
    FROM conversation_participants cp
    JOIN users u ON u.id = cp.user_id
    WHERE cp.conversation_id = ${conversationId}
      AND cp.left_at IS NULL
    ORDER BY
      CASE cp.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
      u.name NULLS LAST
  `);
  return rows.rows.map((r) => ({
    id: r.id as string,
    name: (r.name as string | null) ?? null,
    email: r.email as string,
    avatarUrl: (r.avatar_url as string | null) ?? null,
    role: r.role as 'owner' | 'admin' | 'member',
    joinedAt: r.joined_at as Date,
  }));
}
