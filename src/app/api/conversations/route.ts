import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { listConversationsForUser } from '@/server/chat/queries';
import { getOrCreateDm, userExists } from '@/server/chat/dm';
import { createGroup } from '@/server/chat/groups';
import { limitByIp, writeLimiter } from '@/server/rateLimit';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const conversations = await listConversationsForUser(user.id);
  return NextResponse.json({ conversations });
}

/**
 * Polymorphic conversation creator.
 *
 *   { type: 'dm',    otherUserId }
 *     → getOrCreateDm (idempotent — same pair always resolves to
 *       the same conversation row).
 *
 *   { type: 'group', name, memberIds[, imageUrl] }
 *     → always creates a new group. The caller is auto-included as
 *       'owner'; everyone in memberIds gets role='member'.
 *
 * Back-compat: an old client sending just { otherUserId } (no
 * `type` field) still works — the schema treats type as optional
 * defaulting to 'dm'.
 */
const dmSchema = z.object({
  type: z.literal('dm').optional(),
  otherUserId: z.string().uuid(),
});

const groupSchema = z.object({
  type: z.literal('group'),
  /* Nome agora é opcional — servidor preenche "Grupo sem nome"
   * quando vazio/ausente per product feedback. Limite alto
   * (80) preservado pra que nomes longos quebrem com erro
   * explícito em vez de silenciar. */
  name: z.string().max(80).optional().default(''),
  imageUrl: z.string().max(500).optional().nullable(),
  // Need at least one other member; the auth user is auto-added as owner.
  memberIds: z.array(z.string().uuid()).min(1).max(500),
});

const createSchema = z.union([dmSchema, groupSchema]);

export async function POST(req: Request) {
  // Rate limit: criar conversa/DM é vetor de spam (mensagem
  // automatizada em massa). 10 burst, 6/min sustentado.
  const rl = limitByIp(req, writeLimiter, 'conversations-create');
  if (!rl.ok) return rl.response;

  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // ── Group branch ──────────────────────────────────────────────
  if (parsed.data.type === 'group') {
    try {
      const { id } = await createGroup({
        ownerId: user.id,
        name: parsed.data.name,
        imageUrl: parsed.data.imageUrl ?? null,
        memberIds: parsed.data.memberIds,
      });
      return NextResponse.json({ id, created: true, type: 'group' }, { status: 201 });
    } catch (err) {
      const code = err instanceof Error ? err.message : 'create_failed';
      const status =
        code === 'empty_name' || code === 'name_too_long' || code === 'not_enough_members'
          ? 400
          : code === 'user_not_found'
            ? 404
            : 500;
      if (status === 500) {
        logger.error('conversations.creategroup', err)
      }
      return NextResponse.json({ error: code }, { status });
    }
  }

  // ── DM branch (default) ───────────────────────────────────────
  if (parsed.data.otherUserId === user.id) {
    return NextResponse.json({ error: 'cannot_dm_self' }, { status: 400 });
  }
  if (!(await userExists(parsed.data.otherUserId))) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const { id, created } = await getOrCreateDm(user.id, parsed.data.otherUserId);
  return NextResponse.json(
    { id, created, type: 'dm' },
    { status: created ? 201 : 200 },
  );
}
