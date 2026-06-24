import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  feedCommentReactions,
  feedComments,
  feedPosts,
  notifications,
  users,
} from '../db/schema';
import { recordActivity } from '../activities/queries';
import { publicFirstName } from '../users/serialize';

/**
 * Feed comments + reactions server module.
 *
 *   - getOrCreateFeedPost(postKey) — idempotent. Bridges the mock
 *     feed entries (keyed by media src) to a real DB row so comments
 *     can attach. Future user-authored posts share the same table.
 *
 *   - createComment / createReply — insert a top-level comment or a
 *     reply to an existing comment. Replies inherit the parent's
 *     post_id so the post-level pagination still surfaces them.
 *     Mentions fire 'comment_mention' notifications; replies fire a
 *     'comment_reply' to the parent author.
 *
 *   - listComments(postId, viewerId, before?, limit) — paginated
 *     top-level comments. Each row hydrated with author identity,
 *     reaction count, "did I react" flag, and reply count. Keyset
 *     pagination via the `before` cursor (createdAt).
 *
 *   - listReplies(commentId, viewerId, before?, limit) — same shape
 *     as listComments but scoped to a parent thread.
 *
 *   - toggleCommentReaction — idempotent ❤️ on/off. Returns the new
 *     count + mine flag so the client can render the result without
 *     a second fetch. Fires a 'comment_reaction' notification on the
 *     ADD path (never on remove — don't spam the bell with toggles).
 *
 *   - deleteComment — soft delete. Authors can delete their own;
 *     admins (User.role === 'admin') can delete anyone's.
 */

const SERVER_MENTION_REGEX = /@\[[^\]]+\]\(([0-9a-f-]{36})\)/g;
function parseMentions(body: string): string[] {
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SERVER_MENTION_REGEX.source, 'g');
  while ((m = re.exec(body)) !== null) ids.push(m[1]);
  return Array.from(new Set(ids));
}

export interface HydratedComment {
  id: string;
  postId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: Date;
  deletedAt: Date | null;
  author: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  reactions: {
    /** Total ❤️ count across all users. */
    count: number;
    /** True if the requesting viewer is one of the reactors. */
    mine: boolean;
  };
  /** Top-level only — null on replies. */
  replyCount: number | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a stable `feed_posts.id` for the given client postKey.
 *
 * Two shapes of `postKey` are accepted:
 *   1. A real `feed_posts.id` UUID — comes from admin CMS posts
 *      that the public feed addresses by id. We short-circuit the
 *      upsert and just verify the row exists.
 *   2. A derived slug (e.g. `media:carousel:/feed/ana-1.png`) — the
 *      legacy bridge path for mock posts. Idempotent upsert keyed
 *      on `post_key`.
 *
 * Splitting on UUID shape means CMS posts share their id between
 * the admin row and the comment thread without needing a separate
 * "bridge" row to exist.
 */
export async function getOrCreateFeedPost(
  postKey: string,
  authorUserId: string | null = null,
): Promise<{ id: string }> {
  const trimmed = postKey.trim();
  if (!trimmed) throw new Error('invalid_post_key');
  if (trimmed.length > 500) throw new Error('post_key_too_long');

  // UUID path → direct lookup by id, no insert.
  if (UUID_RE.test(trimmed)) {
    const [row] = await db
      .select({ id: feedPosts.id })
      .from(feedPosts)
      .where(eq(feedPosts.id, trimmed))
      .limit(1);
    if (!row) throw new Error('feed_post_not_found');
    return { id: row.id };
  }

  // Slug path → upsert keyed on post_key.
  const existing = await db
    .select({ id: feedPosts.id })
    .from(feedPosts)
    .where(eq(feedPosts.postKey, trimmed))
    .limit(1);
  if (existing[0]) return { id: existing[0].id };

  // Insert with onConflictDoNothing in case a parallel request
  // raced us between the SELECT and the INSERT.
  const inserted = await db
    .insert(feedPosts)
    .values({ postKey: trimmed, authorUserId })
    .onConflictDoNothing({ target: feedPosts.postKey })
    .returning({ id: feedPosts.id });

  if (inserted[0]) return { id: inserted[0].id };

  // Lost the race — re-read.
  const [row] = await db
    .select({ id: feedPosts.id })
    .from(feedPosts)
    .where(eq(feedPosts.postKey, trimmed))
    .limit(1);
  if (!row) throw new Error('feed_post_create_failed');
  return { id: row.id };
}

/**
 * Insert a top-level comment OR a reply, depending on whether
 * `parentCommentId` is passed. Side-effects:
 *
 *   - 'comment_reply' notification to the parent comment author
 *     (replies only; skipped when replying to oneself).
 *   - 'comment_mention' notifications for any @[Name](uuid) tokens
 *     that resolve to real users (filtered against the actual
 *     users table). The author + parent author are de-duped so the
 *     bell never doubles up on the same event.
 *
 * Returns the new comment id so the caller can render it
 * optimistically alongside the rest of the thread.
 */
export async function createComment(args: {
  postId: string;
  authorId: string;
  body: string;
  parentCommentId?: string | null;
}): Promise<{ id: string }> {
  const trimmed = args.body.trim();
  if (!trimmed) throw new Error('empty_body');
  if (trimmed.length > 2000) throw new Error('body_too_long');

  const result = await db.transaction(async (tx) => {
    // If replying, look up the parent so we can (a) verify it lives
    // under the same post and (b) know who to notify.
    let parentAuthorId: string | null = null;
    if (args.parentCommentId) {
      const [parent] = await tx
        .select({
          postId: feedComments.postId,
          authorId: feedComments.authorId,
          deletedAt: feedComments.deletedAt,
        })
        .from(feedComments)
        .where(eq(feedComments.id, args.parentCommentId))
        .limit(1);
      if (!parent) throw new Error('parent_not_found');
      if (parent.postId !== args.postId) throw new Error('parent_post_mismatch');
      // Replies to a soft-deleted parent are fine — UI shows the
      // "removido" placeholder, replies still attach to the row.
      parentAuthorId = parent.authorId;
    }

    const [row] = await tx
      .insert(feedComments)
      .values({
        postId: args.postId,
        parentCommentId: args.parentCommentId ?? null,
        authorId: args.authorId,
        body: trimmed,
      })
      .returning({ id: feedComments.id });

    // Build the de-duped notification fan-out.
    //
    // 1) Reply notif → parent author (skip if same as commenter).
    // 2) Mention notifs → every @[Name](uuid) that resolves to a
    //    real user, MINUS the commenter and MINUS the parent author
    //    (the reply notification already covers them).
    const notified = new Set<string>([args.authorId]);
    const toInsert: (typeof notifications.$inferInsert)[] = [];

    if (parentAuthorId && parentAuthorId !== args.authorId) {
      toInsert.push({
        userId: parentAuthorId,
        kind: 'comment_reply',
        sourceUserId: args.authorId,
        feedPostId: args.postId,
        commentId: row.id,
      });
      notified.add(parentAuthorId);
    }

    const mentioned = parseMentions(trimmed);
    if (mentioned.length > 0) {
      // Filter against real users so an injected/stale uuid can't
      // notify random ids.
      const realUsers = await tx
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, mentioned));
      const realSet = new Set(realUsers.map((r) => r.id));
      for (const id of mentioned) {
        if (!realSet.has(id)) continue;
        if (notified.has(id)) continue;
        toInsert.push({
          userId: id,
          kind: 'comment_mention',
          sourceUserId: args.authorId,
          feedPostId: args.postId,
          commentId: row.id,
        });
        notified.add(id);
      }
    }

    if (toInsert.length > 0) {
      await tx.insert(notifications).values(toInsert);
    }

    return { id: row.id };
  });

  // Engagement reward — fire-and-forget so a failure here never
  // breaks the comment commit. Migration 0017 gave us the
  // `comment_posted` kind worth +10 FP; the activity row also
  // carries the postId so admin tooling can audit which post
  // drew the comment without joining feedComments.
  void recordActivity(args.authorId, 'comment_posted', {
    postId: args.postId,
  });

  return result;
}

/**
 * Paginated top-level comments. Cursor = the `before` createdAt
 * timestamp — we sort DESC and return rows older than `before`
 * (or the most recent N when `before` is null). The cursor is the
 * createdAt of the LAST row returned, so the client just passes it
 * back to fetch the next page.
 */
export async function listComments(args: {
  postId: string;
  viewerId: string | null;
  before?: Date | null;
  limit?: number;
}): Promise<{ items: HydratedComment[]; hasMore: boolean; nextCursor: string | null }> {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

  const whereClauses = [
    eq(feedComments.postId, args.postId),
    isNull(feedComments.parentCommentId),
  ];
  if (args.before) {
    whereClauses.push(lt(feedComments.createdAt, args.before));
  }

  // Fetch limit+1 so we know whether there's another page without
  // a separate count query.
  const rows = await db
    .select({
      id: feedComments.id,
      postId: feedComments.postId,
      parentCommentId: feedComments.parentCommentId,
      body: feedComments.body,
      createdAt: feedComments.createdAt,
      deletedAt: feedComments.deletedAt,
      authorId: feedComments.authorId,
      authorName: users.name,
      authorEmail: users.email,
      authorIsMinor: users.isMinor,
      authorAvatar: users.avatarUrl,
    })
    .from(feedComments)
    .leftJoin(users, eq(users.id, feedComments.authorId))
    .where(and(...whereClauses))
    .orderBy(desc(feedComments.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const ids = slice.map((r) => r.id);

  // Hydrate reactions + reply counts in two batched queries.
  const [reactionAgg, replyAgg] = await Promise.all([
    aggregateReactions(ids, args.viewerId),
    aggregateReplyCounts(ids),
  ]);

  const items: HydratedComment[] = slice.map((r) => ({
    id: r.id,
    postId: r.postId,
    parentCommentId: r.parentCommentId,
    body: r.body,
    createdAt: r.createdAt,
    deletedAt: r.deletedAt,
    // Proteção a menores: só primeiro nome e SEM e-mail pra menores
    // (comentários são uma listagem pública). Ver [[publicFirstName]].
    author: {
      id: r.authorId,
      name: publicFirstName(r.authorName, Boolean(r.authorIsMinor)),
      email: r.authorIsMinor ? '' : (r.authorEmail ?? ''),
      avatarUrl: r.authorAvatar,
    },
    reactions: reactionAgg.get(r.id) ?? { count: 0, mine: false },
    replyCount: replyAgg.get(r.id) ?? 0,
  }));

  const nextCursor = hasMore && slice.length > 0
    ? slice[slice.length - 1].createdAt.toISOString()
    : null;

  return { items, hasMore, nextCursor };
}

/**
 * Replies to a single parent. Returned oldest-first so the UI can
 * append straight to the thread without re-sorting — replies read
 * naturally top-to-bottom.
 */
export async function listReplies(args: {
  parentCommentId: string;
  viewerId: string | null;
  limit?: number;
}): Promise<HydratedComment[]> {
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);

  const rows = await db
    .select({
      id: feedComments.id,
      postId: feedComments.postId,
      parentCommentId: feedComments.parentCommentId,
      body: feedComments.body,
      createdAt: feedComments.createdAt,
      deletedAt: feedComments.deletedAt,
      authorId: feedComments.authorId,
      authorName: users.name,
      authorEmail: users.email,
      authorIsMinor: users.isMinor,
      authorAvatar: users.avatarUrl,
    })
    .from(feedComments)
    .leftJoin(users, eq(users.id, feedComments.authorId))
    .where(eq(feedComments.parentCommentId, args.parentCommentId))
    .orderBy(feedComments.createdAt)
    .limit(limit);

  const ids = rows.map((r) => r.id);
  const reactionAgg = await aggregateReactions(ids, args.viewerId);

  return rows.map((r) => ({
    id: r.id,
    postId: r.postId,
    parentCommentId: r.parentCommentId,
    body: r.body,
    createdAt: r.createdAt,
    deletedAt: r.deletedAt,
    // Proteção a menores: só primeiro nome e SEM e-mail pra menores.
    author: {
      id: r.authorId,
      name: publicFirstName(r.authorName, Boolean(r.authorIsMinor)),
      email: r.authorIsMinor ? '' : (r.authorEmail ?? ''),
      avatarUrl: r.authorAvatar,
    },
    reactions: reactionAgg.get(r.id) ?? { count: 0, mine: false },
    // Replies don't expose a nested reply count — flat thread, no
    // recursion. (Twitter does nested; we deliberately don't.)
    replyCount: null,
  }));
}

/**
 * Toggle ❤️ on a comment. Idempotent — calling twice with the same
 * user/comment ends back where it started. Returns the new
 * aggregated count + `mine` so the optimistic UI can reconcile
 * without a follow-up fetch.
 *
 * On the ADD path, inserts a 'comment_reaction' notification for
 * the comment's author (skipped when liking your own comment).
 */
export async function toggleCommentReaction(args: {
  commentId: string;
  userId: string;
  emoji?: string;
}): Promise<{ action: 'added' | 'removed'; count: number; mine: boolean }> {
  const emoji = (args.emoji ?? '❤️').trim();
  if (!emoji) throw new Error('invalid_emoji');
  if (emoji.length > 32) throw new Error('emoji_too_long');

  // Make sure the target comment exists + load its author for the
  // notification side-effect.
  const [target] = await db
    .select({
      id: feedComments.id,
      authorId: feedComments.authorId,
      postId: feedComments.postId,
      deletedAt: feedComments.deletedAt,
    })
    .from(feedComments)
    .where(eq(feedComments.id, args.commentId))
    .limit(1);
  if (!target) throw new Error('comment_not_found');
  if (target.deletedAt) throw new Error('comment_deleted');

  const deleted = await db
    .delete(feedCommentReactions)
    .where(
      and(
        eq(feedCommentReactions.commentId, args.commentId),
        eq(feedCommentReactions.userId, args.userId),
        eq(feedCommentReactions.emoji, emoji),
      ),
    )
    .returning({ id: feedCommentReactions.id });

  const action: 'added' | 'removed' = deleted.length > 0 ? 'removed' : 'added';

  if (action === 'added') {
    await db
      .insert(feedCommentReactions)
      .values({ commentId: args.commentId, userId: args.userId, emoji })
      .onConflictDoNothing({
        target: [
          feedCommentReactions.commentId,
          feedCommentReactions.userId,
          feedCommentReactions.emoji,
        ],
      });

    if (target.authorId !== args.userId) {
      await db.insert(notifications).values({
        userId: target.authorId,
        kind: 'comment_reaction',
        sourceUserId: args.userId,
        feedPostId: target.postId,
        commentId: target.id,
        payload: { emoji },
      });
    }
  }

  // Aggregated count for THIS emoji on the comment.
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(feedCommentReactions)
    .where(
      and(
        eq(feedCommentReactions.commentId, args.commentId),
        eq(feedCommentReactions.emoji, emoji),
      ),
    );

  return {
    action,
    count: row?.count ?? 0,
    mine: action === 'added',
  };
}

/**
 * Soft-delete a comment. Author can delete their own; admins can
 * delete anyone's. Returns true on success, false when the caller
 * isn't allowed (404/403 mapping is the route's job).
 *
 * We zero the body to keep the soft-deleted row tiny and to avoid
 * leaving sensitive content readable in the DB. The UI sees
 * `deletedAt != null` and renders "Comentário removido".
 */
export async function deleteComment(args: {
  commentId: string;
  callerId: string;
  callerIsAdmin: boolean;
}): Promise<boolean> {
  const [target] = await db
    .select({
      id: feedComments.id,
      authorId: feedComments.authorId,
      deletedAt: feedComments.deletedAt,
    })
    .from(feedComments)
    .where(eq(feedComments.id, args.commentId))
    .limit(1);
  if (!target) return false;
  if (target.deletedAt) return true; // already deleted — idempotent
  if (!args.callerIsAdmin && target.authorId !== args.callerId) {
    return false;
  }

  /* Soft-delete + cleanup das reactions na mesma tx.
   *
   * Bug histórico: a FK em feedCommentReactions tem onDelete:'cascade',
   * mas o cascade SÓ dispara em DELETE de verdade — não em UPDATE de
   * soft-delete. Resultado prático: usuário comentava, dava like no
   * próprio comentário, apagava o comentário, e o like permanecia na
   * tabela (gerando contagem fantasma + pontos inflacionados).
   *
   * Cleanup explícito aqui resolve sem precisar virar hard-delete
   * (que perderia o histórico de quem deletou o quê). */
  await db.transaction(async (tx) => {
    await tx
      .delete(feedCommentReactions)
      .where(eq(feedCommentReactions.commentId, args.commentId));
    await tx
      .update(feedComments)
      .set({ deletedAt: new Date(), body: '' })
      .where(eq(feedComments.id, args.commentId));
  });

  return true;
}

// ── internal helpers ────────────────────────────────────────────────

async function aggregateReactions(
  commentIds: string[],
  viewerId: string | null,
): Promise<Map<string, { count: number; mine: boolean }>> {
  const out = new Map<string, { count: number; mine: boolean }>();
  if (commentIds.length === 0) return out;

  // Total counts per comment.
  const counts = await db
    .select({
      commentId: feedCommentReactions.commentId,
      count: sql<number>`count(*)::int`,
    })
    .from(feedCommentReactions)
    .where(inArray(feedCommentReactions.commentId, commentIds))
    .groupBy(feedCommentReactions.commentId);

  for (const row of counts) {
    out.set(row.commentId, { count: row.count, mine: false });
  }

  // Viewer's reactions (so we can flip `mine`).
  if (viewerId) {
    const mine = await db
      .select({ commentId: feedCommentReactions.commentId })
      .from(feedCommentReactions)
      .where(
        and(
          inArray(feedCommentReactions.commentId, commentIds),
          eq(feedCommentReactions.userId, viewerId),
        ),
      );
    for (const m of mine) {
      const existing = out.get(m.commentId);
      if (existing) existing.mine = true;
      else out.set(m.commentId, { count: 0, mine: true });
    }
  }

  // Backfill zeroes so the caller can `.get()` without null-checks.
  for (const id of commentIds) {
    if (!out.has(id)) out.set(id, { count: 0, mine: false });
  }
  return out;
}

async function aggregateReplyCounts(
  parentIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (parentIds.length === 0) return out;

  const rows = await db
    .select({
      parentId: feedComments.parentCommentId,
      count: sql<number>`count(*)::int`,
    })
    .from(feedComments)
    .where(inArray(feedComments.parentCommentId, parentIds))
    .groupBy(feedComments.parentCommentId);

  for (const r of rows) {
    if (r.parentId) out.set(r.parentId, r.count);
  }
  for (const id of parentIds) {
    if (!out.has(id)) out.set(id, 0);
  }
  return out;
}
