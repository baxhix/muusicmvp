import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  communities,
  communityMembers,
  communityTopicCommentReactions,
  communityTopicComments,
  communityTopics,
  users,
} from '../db/schema';

/* ── Admin queries for the Communities CMS ────────────────────
 *
 * Mirror the public queries in `./queries.ts` but with no
 * permission gates (the route layer enforces requireAdmin), no
 * trending heuristics, and richer joins so the admin tables can
 * sort + filter by counts the public surface doesn't expose.
 *
 * The admin can:
 *   • list / filter / search communities
 *   • rename, change description, set image, or delete a community
 *   • kick a member out of any community
 *   • soft-delete any topic (deletedAt + reset commentCount)
 *   • hard-delete a topic (cascade — purges comments + reactions)
 *   • soft-delete any topic comment (deletedAt + body cleared)
 *
 * Counters (`memberCount`, `topicCount`, `commentCount`) stay
 * denormalized on the parent rows so the admin list can render
 * cheaply. All mutations that touch a counter wrap in a
 * transaction.
 */

export interface AdminCommunityRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  creatorId: string | null;
  creatorName: string | null;
  creatorEmail: string | null;
  creatorAvatar: string | null;
  memberCount: number;
  topicCount: number;
  /** Sum of non-deleted comments across all topics. */
  commentCount: number;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export async function listAdminCommunities(args: {
  search?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{ items: AdminCommunityRow[]; total: number }> {
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  const offset = Math.max(args.offset ?? 0, 0);
  const trim = (args.search ?? '').trim();

  const where = trim
    ? or(
        ilike(communities.name, `%${trim}%`),
        ilike(communities.description, `%${trim}%`),
        ilike(communities.slug, `%${trim}%`),
      )
    : undefined;

  const rows = await db
    .select({
      id: communities.id,
      slug: communities.slug,
      name: communities.name,
      description: communities.description,
      imageUrl: communities.imageUrl,
      creatorId: communities.creatorId,
      creatorName: users.name,
      creatorEmail: users.email,
      creatorAvatar: users.avatarUrl,
      memberCount: communities.memberCount,
      topicCount: communities.topicCount,
      lastActivityAt: communities.lastActivityAt,
      createdAt: communities.createdAt,
      updatedAt: communities.updatedAt,
    })
    .from(communities)
    .leftJoin(users, eq(users.id, communities.creatorId))
    .where(where)
    .orderBy(desc(communities.lastActivityAt))
    .limit(limit)
    .offset(offset);

  // Total row count (for the table footer). Cheap — single
  // COUNT against the same filter.
  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(communities)
    .where(where);

  // Live comment count per community (sum of non-deleted comments
  // across all its topics). Computed lazily so we don't have to
  // keep yet another denormalized counter in sync. Single grouped
  // query keyed by community_id.
  let commentCountByCommunity = new Map<string, number>();
  if (rows.length > 0) {
    const commentRows = await db
      .select({
        communityId: communityTopics.communityId,
        count: sql<number>`count(*)::int`,
      })
      .from(communityTopicComments)
      .innerJoin(
        communityTopics,
        eq(communityTopics.id, communityTopicComments.topicId),
      )
      .where(isNull(communityTopicComments.deletedAt))
      .groupBy(communityTopics.communityId);
    commentCountByCommunity = new Map(
      commentRows.map((r) => [r.communityId, r.count]),
    );
  }

  const items: AdminCommunityRow[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    imageUrl: r.imageUrl,
    creatorId: r.creatorId,
    creatorName: r.creatorName,
    creatorEmail: r.creatorEmail,
    creatorAvatar: r.creatorAvatar,
    memberCount: r.memberCount,
    topicCount: r.topicCount,
    commentCount: commentCountByCommunity.get(r.id) ?? 0,
    lastActivityAt: r.lastActivityAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return { items, total: totalRow?.count ?? 0 };
}

export async function getAdminCommunity(
  slug: string,
): Promise<AdminCommunityRow | null> {
  const [row] = await db
    .select({
      id: communities.id,
      slug: communities.slug,
      name: communities.name,
      description: communities.description,
      imageUrl: communities.imageUrl,
      creatorId: communities.creatorId,
      creatorName: users.name,
      creatorEmail: users.email,
      creatorAvatar: users.avatarUrl,
      memberCount: communities.memberCount,
      topicCount: communities.topicCount,
      lastActivityAt: communities.lastActivityAt,
      createdAt: communities.createdAt,
      updatedAt: communities.updatedAt,
    })
    .from(communities)
    .leftJoin(users, eq(users.id, communities.creatorId))
    .where(eq(communities.slug, slug))
    .limit(1);
  if (!row) return null;

  const [agg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(communityTopicComments)
    .innerJoin(
      communityTopics,
      eq(communityTopics.id, communityTopicComments.topicId),
    )
    .where(
      and(
        eq(communityTopics.communityId, row.id),
        isNull(communityTopicComments.deletedAt),
      ),
    );

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    imageUrl: row.imageUrl,
    creatorId: row.creatorId,
    creatorName: row.creatorName,
    creatorEmail: row.creatorEmail,
    creatorAvatar: row.creatorAvatar,
    memberCount: row.memberCount,
    topicCount: row.topicCount,
    commentCount: agg?.count ?? 0,
    lastActivityAt: row.lastActivityAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Admin-only patch: name / description / imageUrl / creatorId. */
export async function adminUpdateCommunity(args: {
  slug: string;
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  creatorId?: string;
}): Promise<void> {
  const [row] = await db
    .select({ id: communities.id })
    .from(communities)
    .where(eq(communities.slug, args.slug))
    .limit(1);
  if (!row) throw new Error('not_found');

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof args.name === 'string') {
    const name = args.name.trim();
    if (!name) throw new Error('name_empty');
    if (name.length > 80) throw new Error('name_too_long');
    patch.name = name;
  }
  if (args.description !== undefined) {
    patch.description = args.description?.trim() || null;
  }
  if (args.imageUrl !== undefined) {
    patch.imageUrl = args.imageUrl?.trim() || null;
  }
  if (args.creatorId !== undefined) {
    // Validate the new creator exists AND is already a member.
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, args.creatorId))
      .limit(1);
    if (!user) throw new Error('creator_not_found');
    const [member] = await db
      .select({ userId: communityMembers.userId })
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, row.id),
          eq(communityMembers.userId, args.creatorId),
        ),
      )
      .limit(1);
    if (!member) throw new Error('creator_not_a_member');
    patch.creatorId = args.creatorId;
  }

  await db.update(communities).set(patch).where(eq(communities.id, row.id));
}

/** Admin delete — cascades through members + topics + comments. */
export async function adminDeleteCommunity(slug: string): Promise<void> {
  const [row] = await db
    .select({ id: communities.id })
    .from(communities)
    .where(eq(communities.slug, slug))
    .limit(1);
  if (!row) throw new Error('not_found');
  await db.delete(communities).where(eq(communities.id, row.id));
}

/* ── Members ─────────────────────────────────────────────────── */

export interface AdminCommunityMember {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  joinedAt: string;
  isCreator: boolean;
}

export async function listAdminMembers(args: {
  slug: string;
  search?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{ items: AdminCommunityMember[]; total: number }> {
  const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
  const offset = Math.max(args.offset ?? 0, 0);

  const [row] = await db
    .select({ id: communities.id, creatorId: communities.creatorId })
    .from(communities)
    .where(eq(communities.slug, args.slug))
    .limit(1);
  if (!row) throw new Error('not_found');

  const trim = (args.search ?? '').trim();
  const whereClauses = [eq(communityMembers.communityId, row.id)];
  if (trim) {
    whereClauses.push(
      or(ilike(users.name, `%${trim}%`), ilike(users.email, `%${trim}%`))!,
    );
  }

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      joinedAt: communityMembers.joinedAt,
    })
    .from(communityMembers)
    .innerJoin(users, eq(users.id, communityMembers.userId))
    .where(and(...whereClauses))
    .orderBy(desc(communityMembers.joinedAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(communityMembers)
    .innerJoin(users, eq(users.id, communityMembers.userId))
    .where(and(...whereClauses));

  const items: AdminCommunityMember[] = rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    avatarUrl: r.avatarUrl,
    joinedAt: r.joinedAt.toISOString(),
    isCreator: r.userId === row.creatorId,
  }));

  return { items, total: totalRow?.count ?? 0 };
}

/**
 * Force a user out of a community. Admin override — bypasses the
 * "creator can't leave" guard. If the kicked user IS the creator
 * the membership is removed but creatorId stays (the row reads as
 * "orphaned"); to fully reassign, call `adminUpdateCommunity` with
 * `creatorId` set to the new owner.
 */
export async function adminRemoveMember(args: {
  slug: string;
  userId: string;
}): Promise<{ removed: boolean }> {
  const [row] = await db
    .select({ id: communities.id })
    .from(communities)
    .where(eq(communities.slug, args.slug))
    .limit(1);
  if (!row) throw new Error('not_found');

  return db.transaction(async (tx) => {
    const deleted = await tx
      .delete(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, row.id),
          eq(communityMembers.userId, args.userId),
        ),
      )
      .returning({ userId: communityMembers.userId });

    if (deleted.length === 0) return { removed: false };

    await tx
      .update(communities)
      .set({
        memberCount: sql`GREATEST(${communities.memberCount} - 1, 0)`,
      })
      .where(eq(communities.id, row.id));

    return { removed: true };
  });
}

/* ── Topics ──────────────────────────────────────────────────── */

export interface AdminCommunityTopic {
  id: string;
  communityId: string;
  title: string;
  body: string | null;
  authorId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  authorAvatar: string | null;
  commentCount: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listAdminTopics(args: {
  slug: string;
  search?: string | null;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ items: AdminCommunityTopic[]; total: number }> {
  const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
  const offset = Math.max(args.offset ?? 0, 0);

  const [row] = await db
    .select({ id: communities.id })
    .from(communities)
    .where(eq(communities.slug, args.slug))
    .limit(1);
  if (!row) throw new Error('not_found');

  const trim = (args.search ?? '').trim();
  const whereClauses = [eq(communityTopics.communityId, row.id)];
  if (!args.includeDeleted) {
    whereClauses.push(isNull(communityTopics.deletedAt));
  }
  if (trim) {
    whereClauses.push(
      or(
        ilike(communityTopics.title, `%${trim}%`),
        ilike(communityTopics.body, `%${trim}%`),
      )!,
    );
  }

  const rows = await db
    .select({
      id: communityTopics.id,
      communityId: communityTopics.communityId,
      title: communityTopics.title,
      body: communityTopics.body,
      authorId: communityTopics.authorId,
      authorName: users.name,
      authorEmail: users.email,
      authorAvatar: users.avatarUrl,
      commentCount: communityTopics.commentCount,
      deletedAt: communityTopics.deletedAt,
      createdAt: communityTopics.createdAt,
      updatedAt: communityTopics.updatedAt,
    })
    .from(communityTopics)
    .leftJoin(users, eq(users.id, communityTopics.authorId))
    .where(and(...whereClauses))
    .orderBy(desc(communityTopics.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(communityTopics)
    .where(and(...whereClauses));

  const items: AdminCommunityTopic[] = rows.map((r) => ({
    id: r.id,
    communityId: r.communityId,
    title: r.title,
    body: r.body,
    authorId: r.authorId,
    authorName: r.authorName,
    authorEmail: r.authorEmail,
    authorAvatar: r.authorAvatar,
    commentCount: r.commentCount,
    deletedAt: r.deletedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return { items, total: totalRow?.count ?? 0 };
}

export async function getAdminTopic(
  topicId: string,
): Promise<AdminCommunityTopic | null> {
  const [row] = await db
    .select({
      id: communityTopics.id,
      communityId: communityTopics.communityId,
      title: communityTopics.title,
      body: communityTopics.body,
      authorId: communityTopics.authorId,
      authorName: users.name,
      authorEmail: users.email,
      authorAvatar: users.avatarUrl,
      commentCount: communityTopics.commentCount,
      deletedAt: communityTopics.deletedAt,
      createdAt: communityTopics.createdAt,
      updatedAt: communityTopics.updatedAt,
    })
    .from(communityTopics)
    .leftJoin(users, eq(users.id, communityTopics.authorId))
    .where(eq(communityTopics.id, topicId))
    .limit(1);
  if (!row) return null;

  return {
    id: row.id,
    communityId: row.communityId,
    title: row.title,
    body: row.body,
    authorId: row.authorId,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    authorAvatar: row.authorAvatar,
    commentCount: row.commentCount,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function adminUpdateTopic(args: {
  topicId: string;
  title?: string;
  body?: string | null;
}): Promise<void> {
  const [row] = await db
    .select({ id: communityTopics.id })
    .from(communityTopics)
    .where(eq(communityTopics.id, args.topicId))
    .limit(1);
  if (!row) throw new Error('not_found');

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof args.title === 'string') {
    const t = args.title.trim();
    if (!t) throw new Error('title_empty');
    if (t.length > 200) throw new Error('title_too_long');
    patch.title = t;
  }
  if (args.body !== undefined) {
    patch.body = args.body?.trim() || null;
  }

  await db
    .update(communityTopics)
    .set(patch)
    .where(eq(communityTopics.id, row.id));
}

/**
 * Soft-delete a topic. Comments stay in the DB but the public list
 * filters by `deletedAt IS NULL`. Setting `restore: true` clears
 * the soft-delete instead.
 */
export async function adminSoftDeleteTopic(args: {
  topicId: string;
  restore?: boolean;
}): Promise<void> {
  const [row] = await db
    .select({
      id: communityTopics.id,
      communityId: communityTopics.communityId,
      deletedAt: communityTopics.deletedAt,
    })
    .from(communityTopics)
    .where(eq(communityTopics.id, args.topicId))
    .limit(1);
  if (!row) throw new Error('not_found');

  const isDeleted = row.deletedAt !== null;
  const restore = !!args.restore;
  if (restore && !isDeleted) return; // no-op
  if (!restore && isDeleted) return;

  await db.transaction(async (tx) => {
    await tx
      .update(communityTopics)
      .set({ deletedAt: restore ? null : new Date(), updatedAt: new Date() })
      .where(eq(communityTopics.id, row.id));

    // Keep `topicCount` honest: bump down on delete, back up on restore.
    await tx
      .update(communities)
      .set({
        topicCount: restore
          ? sql`${communities.topicCount} + 1`
          : sql`GREATEST(${communities.topicCount} - 1, 0)`,
      })
      .where(eq(communities.id, row.communityId));
  });
}

/** Hard-delete a topic — cascade nukes its comments + reactions. */
export async function adminHardDeleteTopic(topicId: string): Promise<void> {
  const [row] = await db
    .select({
      id: communityTopics.id,
      communityId: communityTopics.communityId,
      deletedAt: communityTopics.deletedAt,
    })
    .from(communityTopics)
    .where(eq(communityTopics.id, topicId))
    .limit(1);
  if (!row) throw new Error('not_found');

  await db.transaction(async (tx) => {
    await tx.delete(communityTopics).where(eq(communityTopics.id, row.id));
    // If the topic wasn't already soft-deleted, the visible count
    // needs to drop too.
    if (!row.deletedAt) {
      await tx
        .update(communities)
        .set({
          topicCount: sql`GREATEST(${communities.topicCount} - 1, 0)`,
        })
        .where(eq(communities.id, row.communityId));
    }
  });
}

/* ── Comments ────────────────────────────────────────────────── */

export interface AdminCommunityTopicComment {
  id: string;
  topicId: string;
  parentCommentId: string | null;
  body: string;
  deletedAt: string | null;
  createdAt: string;
  author: {
    id: string | null;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  reactionCount: number;
}

export async function listAdminTopicComments(args: {
  topicId: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ items: AdminCommunityTopicComment[]; total: number }> {
  const limit = Math.min(Math.max(args.limit ?? 200, 1), 500);
  const offset = Math.max(args.offset ?? 0, 0);

  const whereClauses = [eq(communityTopicComments.topicId, args.topicId)];
  if (!args.includeDeleted) {
    whereClauses.push(isNull(communityTopicComments.deletedAt));
  }

  const rows = await db
    .select({
      id: communityTopicComments.id,
      topicId: communityTopicComments.topicId,
      parentCommentId: communityTopicComments.parentCommentId,
      body: communityTopicComments.body,
      deletedAt: communityTopicComments.deletedAt,
      createdAt: communityTopicComments.createdAt,
      authorId: communityTopicComments.authorId,
      authorName: users.name,
      authorEmail: users.email,
      authorAvatar: users.avatarUrl,
    })
    .from(communityTopicComments)
    .leftJoin(users, eq(users.id, communityTopicComments.authorId))
    .where(and(...whereClauses))
    .orderBy(communityTopicComments.createdAt)
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(communityTopicComments)
    .where(and(...whereClauses));

  // Reaction counts per comment, single grouped query.
  let reactionsByComment = new Map<string, number>();
  if (rows.length > 0) {
    const reactionRows = await db
      .select({
        commentId: communityTopicCommentReactions.commentId,
        count: sql<number>`count(*)::int`,
      })
      .from(communityTopicCommentReactions)
      .groupBy(communityTopicCommentReactions.commentId);
    reactionsByComment = new Map(
      reactionRows.map((r) => [r.commentId, r.count]),
    );
  }

  const items: AdminCommunityTopicComment[] = rows.map((r) => ({
    id: r.id,
    topicId: r.topicId,
    parentCommentId: r.parentCommentId,
    body: r.body,
    deletedAt: r.deletedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    author: {
      id: r.authorId,
      name: r.authorName,
      email: r.authorEmail,
      avatarUrl: r.authorAvatar,
    },
    reactionCount: reactionsByComment.get(r.id) ?? 0,
  }));

  return { items, total: totalRow?.count ?? 0 };
}

export async function adminSoftDeleteComment(args: {
  commentId: string;
  restore?: boolean;
}): Promise<void> {
  const [row] = await db
    .select({
      id: communityTopicComments.id,
      topicId: communityTopicComments.topicId,
      deletedAt: communityTopicComments.deletedAt,
      body: communityTopicComments.body,
    })
    .from(communityTopicComments)
    .where(eq(communityTopicComments.id, args.commentId))
    .limit(1);
  if (!row) throw new Error('not_found');

  const isDeleted = row.deletedAt !== null;
  const restore = !!args.restore;
  if (restore && !isDeleted) return;
  if (!restore && isDeleted) return;

  await db.transaction(async (tx) => {
    await tx
      .update(communityTopicComments)
      .set({
        deletedAt: restore ? null : new Date(),
        // On delete, zero the body so the soft-deleted row doesn't
        // leak content. Restore can't recover the original (mirrors
        // the feed-comments rule).
        body: restore ? row.body : '',
      })
      .where(eq(communityTopicComments.id, row.id));

    /* Drop the comment's reactions on soft-delete. A `restore`
     * recupera o comment mas NÃO recupera as reactions — quem
     * tinha curtido antes precisaria curtir de novo (estilo
     * Slack / iMessage). Sem essa limpeza as reactions ficavam
     * órfãs no banco (mesmo bug do feed_comments). */
    if (!restore) {
      await tx
        .delete(communityTopicCommentReactions)
        .where(eq(communityTopicCommentReactions.commentId, row.id));
    }

    // Keep topic.commentCount honest. Restore bumps up, delete
    // bumps down.
    await tx
      .update(communityTopics)
      .set({
        commentCount: restore
          ? sql`${communityTopics.commentCount} + 1`
          : sql`GREATEST(${communityTopics.commentCount} - 1, 0)`,
      })
      .where(eq(communityTopics.id, row.topicId));
  });
}

export async function adminHardDeleteComment(commentId: string): Promise<void> {
  const [row] = await db
    .select({
      id: communityTopicComments.id,
      topicId: communityTopicComments.topicId,
      deletedAt: communityTopicComments.deletedAt,
    })
    .from(communityTopicComments)
    .where(eq(communityTopicComments.id, commentId))
    .limit(1);
  if (!row) throw new Error('not_found');

  await db.transaction(async (tx) => {
    await tx
      .delete(communityTopicComments)
      .where(eq(communityTopicComments.id, row.id));
    // Hard-delete doesn't double-decrement if the row was already soft-deleted.
    if (!row.deletedAt) {
      await tx
        .update(communityTopics)
        .set({
          commentCount: sql`GREATEST(${communityTopics.commentCount} - 1, 0)`,
        })
        .where(eq(communityTopics.id, row.topicId));
    }
  });
}
