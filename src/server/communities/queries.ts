import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm';
import { db } from '../db';
import {
  communities,
  communityMembers,
  communityTopicCommentReactions,
  communityTopicComments,
  communityTopics,
  users,
} from '../db/schema';
import { getUserPoints } from '../activities/queries';
import { publicFirstName } from '../users/serialize';

/* ── Communities (forum) data layer ───────────────────────────
 *
 * Rules enforced here:
 *   • createCommunity: requires the creator to have ≥10k Fanpoints.
 *     Throws 'insufficient_fanpoints' otherwise.
 *   • deleteCommunity: only the creator can delete. Throws
 *     'forbidden' otherwise.
 *   • createTopic: the author must be a member of the community.
 *     Throws 'not_a_member' otherwise.
 *   • listMembers: only accessible to members. The API layer
 *     enforces this; the query itself just returns the rows.
 *
 * Trending ("Bombando") is computed in `listCommunities`: any
 * community where `lastActivityAt > now() - 7 days` AND
 * memberCount ≥ 3 gets the flag set. Cheap to compute on the
 * read side — no scheduled job, no extra column.
 *
 * `lastActivityAt` is bumped whenever a topic or topic comment
 * lands; that keeps the sort + the flag fresh without writes on
 * every read.
 */

/** Minimum Fanpoints required to spawn a community.
 * 10_000 → 200 per spec "mude a regra para criação de comunidade
 * para 200 Fanpoints". Manter sincronizado com
 * CREATE_FP_THRESHOLD no CommunityPanel.tsx. */
const CREATE_COMMUNITY_FP_THRESHOLD = 200;
/** "Bombando" thresholds — recent activity + a minimum critical mass. */
const TRENDING_WINDOW_DAYS = 7;
const TRENDING_MIN_MEMBERS = 3;

/** Slugify a display name: lowercase, ASCII, hyphenated. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export interface ApiCommunityCard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  creatorId: string;
  memberCount: number;
  topicCount: number;
  lastActivityAt: string;
  createdAt: string;
  isMember: boolean;
  isTrending: boolean;
}

/**
 * Paginated list of communities. Optional case-insensitive search
 * across name + description. Returns the viewer's own membership
 * flag per row so the "Participar / Sair" CTA can render correctly
 * without a second roundtrip.
 */
export async function listCommunities(args: {
  viewerId: string | null;
  search?: string | null;
  limit?: number;
}): Promise<{ items: ApiCommunityCard[] }> {
  const limit = Math.min(Math.max(args.limit ?? 30, 1), 100);
  const trim = (args.search ?? '').trim();

  const baseWhere = trim
    ? or(
        ilike(communities.name, `%${trim}%`),
        ilike(communities.description, `%${trim}%`),
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
      memberCount: communities.memberCount,
      topicCount: communities.topicCount,
      lastActivityAt: communities.lastActivityAt,
      createdAt: communities.createdAt,
    })
    .from(communities)
    .where(baseWhere)
    .orderBy(desc(communities.lastActivityAt), desc(communities.memberCount))
    .limit(limit);

  // Hydrate the membership flag for each row in one round-trip.
  let membershipSet = new Set<string>();
  if (args.viewerId) {
    const memberRows = await db
      .select({ communityId: communityMembers.communityId })
      .from(communityMembers)
      .where(eq(communityMembers.userId, args.viewerId));
    membershipSet = new Set(memberRows.map((m) => m.communityId));
  }

  const trendingThreshold = new Date(
    Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const items: ApiCommunityCard[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    imageUrl: r.imageUrl,
    creatorId: r.creatorId,
    memberCount: r.memberCount,
    topicCount: r.topicCount,
    lastActivityAt: r.lastActivityAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    isMember: membershipSet.has(r.id),
    isTrending:
      r.lastActivityAt > trendingThreshold &&
      r.memberCount >= TRENDING_MIN_MEMBERS,
  }));

  return { items };
}

export interface ApiCommunityMemberPreview {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface ApiCommunityDetail extends ApiCommunityCard {
  isCreator: boolean;
  /**
   * Up to 5 most-recent members for the avatar-stack preview in
   * the community detail header. The full roster is on
   * `/api/communities/:slug/members` (member-only).
   */
  memberPreviews: ApiCommunityMemberPreview[];
  /** Creator's name + avatar for the "by …" mini avatar in the header. */
  creator: ApiCommunityMemberPreview | null;
}

/** Single community by slug. Includes the viewer's role flags. */
export async function getCommunityBySlug(
  slug: string,
  viewerId: string | null,
): Promise<ApiCommunityDetail | null> {
  const [row] = await db
    .select()
    .from(communities)
    .where(eq(communities.slug, slug))
    .limit(1);
  if (!row) return null;

  let isMember = false;
  if (viewerId) {
    const [mem] = await db
      .select({ userId: communityMembers.userId })
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, row.id),
          eq(communityMembers.userId, viewerId),
        ),
      )
      .limit(1);
    isMember = !!mem;
  }

  const trendingThreshold = new Date(
    Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  // Member previews — 5 most-recent for the avatar stack. Public:
  // anyone visiting the community page sees who's in it (matches
  // the open-by-default forum convention).
  const previewRowsRaw = await db
    .select({
      id: users.id,
      name: users.name,
      isMinor: users.isMinor,
      avatarUrl: users.avatarUrl,
    })
    .from(communityMembers)
    .innerJoin(users, eq(users.id, communityMembers.userId))
    .where(eq(communityMembers.communityId, row.id))
    .orderBy(desc(communityMembers.joinedAt))
    .limit(5);
  // Proteção a menores: só primeiro nome pra membros menores de idade.
  const previewRows = previewRowsRaw.map((m) => ({
    id: m.id,
    name: publicFirstName(m.name, Boolean(m.isMinor)),
    avatarUrl: m.avatarUrl,
  }));

  // Creator mini-avatar. Resolved separately so it's stable even
  // if the creator dropped out of the latest-5 preview window.
  const [creatorRow] = await db
    .select({
      id: users.id,
      name: users.name,
      isMinor: users.isMinor,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, row.creatorId))
    .limit(1);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    imageUrl: row.imageUrl,
    creatorId: row.creatorId,
    memberCount: row.memberCount,
    topicCount: row.topicCount,
    lastActivityAt: row.lastActivityAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    isMember,
    isTrending:
      row.lastActivityAt > trendingThreshold &&
      row.memberCount >= TRENDING_MIN_MEMBERS,
    isCreator: viewerId === row.creatorId,
    memberPreviews: previewRows,
    creator: creatorRow
      ? {
          id: creatorRow.id,
          name: publicFirstName(creatorRow.name, Boolean(creatorRow.isMinor)),
          avatarUrl: creatorRow.avatarUrl,
        }
      : null,
  };
}

/**
 * Create a community. The creator is auto-joined as the first
 * member (member_count starts at 1). Slug is derived from the
 * name; on collision, a -2, -3, ... suffix is appended.
 *
 * Throws:
 *   'insufficient_fanpoints' — creator has < 10k FP
 *   'name_empty' / 'name_too_long' — basic input validation
 */
export async function createCommunity(args: {
  creatorId: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
}): Promise<{ id: string; slug: string }> {
  const name = args.name.trim();
  if (!name) throw new Error('name_empty');
  if (name.length > 80) throw new Error('name_too_long');

  const fp = await getUserPoints(args.creatorId);
  if (fp < CREATE_COMMUNITY_FP_THRESHOLD) {
    throw new Error('insufficient_fanpoints');
  }

  const baseSlug = slugify(name) || 'comunidade';

  return db.transaction(async (tx) => {
    // Find a unique slug: baseSlug, baseSlug-2, baseSlug-3, ...
    let slug = baseSlug;
    let suffix = 1;
    /* eslint-disable no-constant-condition */
    while (true) {
      const [existing] = await tx
        .select({ id: communities.id })
        .from(communities)
        .where(eq(communities.slug, slug))
        .limit(1);
      if (!existing) break;
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }
    /* eslint-enable no-constant-condition */

    const [row] = await tx
      .insert(communities)
      .values({
        slug,
        name,
        description: args.description?.trim() || null,
        imageUrl: args.imageUrl?.trim() || null,
        creatorId: args.creatorId,
        memberCount: 1,
        topicCount: 0,
      })
      .returning({ id: communities.id, slug: communities.slug });

    // Auto-join the creator.
    await tx.insert(communityMembers).values({
      communityId: row.id,
      userId: args.creatorId,
    });

    return { id: row.id, slug: row.slug };
  });
}

/** Soft… actually full delete. Only the creator can delete. */
export async function deleteCommunity(args: {
  slug: string;
  viewerId: string;
}): Promise<void> {
  const [row] = await db
    .select({ id: communities.id, creatorId: communities.creatorId })
    .from(communities)
    .where(eq(communities.slug, args.slug))
    .limit(1);
  if (!row) throw new Error('not_found');
  if (row.creatorId !== args.viewerId) throw new Error('forbidden');

  await db.delete(communities).where(eq(communities.id, row.id));
}

/**
 * Update a community's name (and optionally description/imageUrl).
 * Creator-only — same authorization rule as deleteCommunity. The
 * slug stays fixed once the community exists so existing links keep
 * resolving even after a rename.
 *
 * Throws:
 *   'not_found' — no community with the given slug
 *   'forbidden' — caller is not the creator
 *   'name_empty' / 'name_too_long' — basic input validation
 */
export async function updateCommunity(args: {
  slug: string;
  viewerId: string;
  name?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}): Promise<void> {
  const [row] = await db
    .select({ id: communities.id, creatorId: communities.creatorId })
    .from(communities)
    .where(eq(communities.slug, args.slug))
    .limit(1);
  if (!row) throw new Error('not_found');
  if (row.creatorId !== args.viewerId) throw new Error('forbidden');

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

  await db.update(communities).set(patch).where(eq(communities.id, row.id));
}

/**
 * Idempotent join. Returns { joined: true } on the insert and
 * { joined: false } if the viewer was already a member (used by
 * the UI to skip a redundant "Joined!" toast).
 */
export async function joinCommunity(args: {
  slug: string;
  userId: string;
}): Promise<{ joined: boolean; communityId: string }> {
  const [row] = await db
    .select({ id: communities.id })
    .from(communities)
    .where(eq(communities.slug, args.slug))
    .limit(1);
  if (!row) throw new Error('not_found');

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ userId: communityMembers.userId })
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, row.id),
          eq(communityMembers.userId, args.userId),
        ),
      )
      .limit(1);
    if (existing) return { joined: false, communityId: row.id };

    await tx.insert(communityMembers).values({
      communityId: row.id,
      userId: args.userId,
    });
    await tx
      .update(communities)
      .set({ memberCount: sql`${communities.memberCount} + 1` })
      .where(eq(communities.id, row.id));

    return { joined: true, communityId: row.id };
  });
}

/** Leave (idempotent). Returns the new memberCount snapshot. */
export async function leaveCommunity(args: {
  slug: string;
  userId: string;
}): Promise<{ left: boolean; communityId: string }> {
  const [row] = await db
    .select({ id: communities.id, creatorId: communities.creatorId })
    .from(communities)
    .where(eq(communities.slug, args.slug))
    .limit(1);
  if (!row) throw new Error('not_found');
  // Creators stay members of their own community. They have to
  // delete the community first if they really want out.
  if (row.creatorId === args.userId) throw new Error('creator_cannot_leave');

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

    if (deleted.length === 0) return { left: false, communityId: row.id };

    await tx
      .update(communities)
      .set({
        memberCount: sql`GREATEST(${communities.memberCount} - 1, 0)`,
      })
      .where(eq(communities.id, row.id));

    return { left: true, communityId: row.id };
  });
}

export interface ApiCommunityMember {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  isCreator: boolean;
}

/** List members of a community. Caller must enforce member-only access. */
export async function listMembers(args: {
  slug: string;
  limit?: number;
}): Promise<{ items: ApiCommunityMember[] }> {
  const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);

  const [row] = await db
    .select({ id: communities.id, creatorId: communities.creatorId })
    .from(communities)
    .where(eq(communities.slug, args.slug))
    .limit(1);
  if (!row) throw new Error('not_found');

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      isMinor: users.isMinor,
      avatarUrl: users.avatarUrl,
      joinedAt: communityMembers.joinedAt,
    })
    .from(communityMembers)
    .innerJoin(users, eq(users.id, communityMembers.userId))
    .where(eq(communityMembers.communityId, row.id))
    .orderBy(desc(communityMembers.joinedAt))
    .limit(limit);

  const items: ApiCommunityMember[] = rows.map((r) => ({
    userId: r.userId,
    // Proteção a menores: só primeiro nome pra membros menores de idade.
    name: publicFirstName(r.name, Boolean(r.isMinor)),
    avatarUrl: r.avatarUrl,
    joinedAt: r.joinedAt.toISOString(),
    isCreator: r.userId === row.creatorId,
  }));

  return { items };
}

/** Is this viewer a member of the slug'd community? */
export async function isMember(
  slug: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: communities.id })
    .from(communities)
    .where(eq(communities.slug, slug))
    .limit(1);
  if (!row) return false;
  const [mem] = await db
    .select({ userId: communityMembers.userId })
    .from(communityMembers)
    .where(
      and(
        eq(communityMembers.communityId, row.id),
        eq(communityMembers.userId, userId),
      ),
    )
    .limit(1);
  return !!mem;
}

/* ── Topics ───────────────────────────────────────────────────── */

export interface ApiCommunityTopic {
  id: string;
  communityId: string;
  title: string;
  body: string | null;
  authorId: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  commentCount: number;
  createdAt: string;
  deletedAt: string | null;
}

export async function listTopics(args: {
  slug: string;
  search?: string | null;
  before?: Date | null;
  limit?: number;
}): Promise<{ items: ApiCommunityTopic[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(args.limit ?? 30, 1), 100);

  const [row] = await db
    .select({ id: communities.id })
    .from(communities)
    .where(eq(communities.slug, args.slug))
    .limit(1);
  if (!row) throw new Error('not_found');

  const trim = (args.search ?? '').trim();
  const whereClauses = [
    eq(communityTopics.communityId, row.id),
    isNull(communityTopics.deletedAt),
  ];
  if (trim) {
    whereClauses.push(
      or(
        ilike(communityTopics.title, `%${trim}%`),
        ilike(communityTopics.body, `%${trim}%`),
      )!,
    );
  }
  if (args.before) {
    whereClauses.push(lt(communityTopics.createdAt, args.before));
  }

  const rows = await db
    .select({
      id: communityTopics.id,
      communityId: communityTopics.communityId,
      title: communityTopics.title,
      body: communityTopics.body,
      authorId: communityTopics.authorId,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
      commentCount: communityTopics.commentCount,
      createdAt: communityTopics.createdAt,
      deletedAt: communityTopics.deletedAt,
    })
    .from(communityTopics)
    .leftJoin(users, eq(users.id, communityTopics.authorId))
    .where(and(...whereClauses))
    .orderBy(desc(communityTopics.createdAt))
    .limit(limit + 1);

  const items: ApiCommunityTopic[] = rows.slice(0, limit).map((r) => ({
    id: r.id,
    communityId: r.communityId,
    title: r.title,
    body: r.body,
    authorId: r.authorId,
    authorName: r.authorName,
    authorAvatar: r.authorAvatar,
    commentCount: r.commentCount,
    createdAt: r.createdAt.toISOString(),
    deletedAt: r.deletedAt?.toISOString() ?? null,
  }));

  return { items, hasMore: rows.length > limit };
}

/**
 * Create a topic in a community. The author MUST be a member —
 * the route layer should also enforce this for a clean 403 vs
 * 404, but the throw here makes it idempotent.
 */
export async function createTopic(args: {
  slug: string;
  authorId: string;
  title: string;
  body?: string | null;
}): Promise<{ id: string }> {
  const title = args.title.trim();
  if (!title) throw new Error('title_empty');
  if (title.length > 200) throw new Error('title_too_long');

  const [community] = await db
    .select({ id: communities.id })
    .from(communities)
    .where(eq(communities.slug, args.slug))
    .limit(1);
  if (!community) throw new Error('not_found');

  const [mem] = await db
    .select({ userId: communityMembers.userId })
    .from(communityMembers)
    .where(
      and(
        eq(communityMembers.communityId, community.id),
        eq(communityMembers.userId, args.authorId),
      ),
    )
    .limit(1);
  if (!mem) throw new Error('not_a_member');

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(communityTopics)
      .values({
        communityId: community.id,
        authorId: args.authorId,
        title,
        body: args.body?.trim() || null,
        commentCount: 0,
      })
      .returning({ id: communityTopics.id });

    await tx
      .update(communities)
      .set({
        topicCount: sql`${communities.topicCount} + 1`,
        lastActivityAt: new Date(),
      })
      .where(eq(communities.id, community.id));

    return { id: row.id };
  });
}

export async function getTopic(args: {
  topicId: string;
}): Promise<ApiCommunityTopic | null> {
  const [row] = await db
    .select({
      id: communityTopics.id,
      communityId: communityTopics.communityId,
      title: communityTopics.title,
      body: communityTopics.body,
      authorId: communityTopics.authorId,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
      commentCount: communityTopics.commentCount,
      createdAt: communityTopics.createdAt,
      deletedAt: communityTopics.deletedAt,
    })
    .from(communityTopics)
    .leftJoin(users, eq(users.id, communityTopics.authorId))
    .where(eq(communityTopics.id, args.topicId))
    .limit(1);
  if (!row) return null;

  return {
    id: row.id,
    communityId: row.communityId,
    title: row.title,
    body: row.body,
    authorId: row.authorId,
    authorName: row.authorName,
    authorAvatar: row.authorAvatar,
    commentCount: row.commentCount,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

/* ── Topic comments ───────────────────────────────────────────── */

export interface ApiCommunityTopicComment {
  id: string;
  topicId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: string;
  deletedAt: string | null;
  author: {
    id: string | null;
    name: string | null;
    avatarUrl: string | null;
  };
  /** Aggregated ❤️ reactions. `mine` reflects the viewer's state. */
  reactions: {
    count: number;
    mine: boolean;
  };
  /** Replies count. Null for replies themselves (threads stay flat). */
  replyCount: number | null;
}

export async function listTopicComments(args: {
  topicId: string;
  viewerId?: string | null;
  limit?: number;
}): Promise<{ items: ApiCommunityTopicComment[] }> {
  const limit = Math.min(Math.max(args.limit ?? 200, 1), 500);

  const rows = await db
    .select({
      id: communityTopicComments.id,
      topicId: communityTopicComments.topicId,
      parentCommentId: communityTopicComments.parentCommentId,
      body: communityTopicComments.body,
      createdAt: communityTopicComments.createdAt,
      deletedAt: communityTopicComments.deletedAt,
      authorId: communityTopicComments.authorId,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(communityTopicComments)
    .leftJoin(users, eq(users.id, communityTopicComments.authorId))
    .where(eq(communityTopicComments.topicId, args.topicId))
    .orderBy(communityTopicComments.createdAt)
    .limit(limit);

  const ids = rows.map((r) => r.id);
  const reactionAgg = await aggregateCommentReactions(
    ids,
    args.viewerId ?? null,
  );
  const replyAgg = await aggregateReplyCounts(ids);

  const items: ApiCommunityTopicComment[] = rows.map((r) => ({
    id: r.id,
    topicId: r.topicId,
    parentCommentId: r.parentCommentId,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    deletedAt: r.deletedAt?.toISOString() ?? null,
    author: {
      id: r.authorId,
      name: r.authorName,
      avatarUrl: r.authorAvatar,
    },
    reactions: reactionAgg.get(r.id) ?? { count: 0, mine: false },
    // Replies are flat → only top-level comments expose a reply count.
    replyCount: r.parentCommentId === null ? (replyAgg.get(r.id) ?? 0) : null,
  }));

  return { items };
}

/**
 * Toggle a ❤️ reaction on a topic comment. Same pattern as the feed
 * comment toggle in `src/server/feed/comments.ts` — single emoji per
 * (user, comment) so the call is idempotent.
 */
export async function toggleTopicCommentReaction(args: {
  commentId: string;
  userId: string;
  emoji?: string;
}): Promise<{ action: 'added' | 'removed'; count: number; mine: boolean }> {
  const emoji = (args.emoji ?? '❤️').trim();
  if (!emoji) throw new Error('invalid_emoji');
  if (emoji.length > 32) throw new Error('emoji_too_long');

  const [target] = await db
    .select({
      id: communityTopicComments.id,
      deletedAt: communityTopicComments.deletedAt,
    })
    .from(communityTopicComments)
    .where(eq(communityTopicComments.id, args.commentId))
    .limit(1);
  if (!target) throw new Error('comment_not_found');
  if (target.deletedAt) throw new Error('comment_deleted');

  const deleted = await db
    .delete(communityTopicCommentReactions)
    .where(
      and(
        eq(communityTopicCommentReactions.commentId, args.commentId),
        eq(communityTopicCommentReactions.userId, args.userId),
        eq(communityTopicCommentReactions.emoji, emoji),
      ),
    )
    .returning({ id: communityTopicCommentReactions.id });

  const action: 'added' | 'removed' = deleted.length > 0 ? 'removed' : 'added';

  if (action === 'added') {
    await db
      .insert(communityTopicCommentReactions)
      .values({ commentId: args.commentId, userId: args.userId, emoji })
      .onConflictDoNothing({
        target: [
          communityTopicCommentReactions.commentId,
          communityTopicCommentReactions.userId,
          communityTopicCommentReactions.emoji,
        ],
      });
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(communityTopicCommentReactions)
    .where(
      and(
        eq(communityTopicCommentReactions.commentId, args.commentId),
        eq(communityTopicCommentReactions.emoji, emoji),
      ),
    );

  return {
    action,
    count: row?.count ?? 0,
    mine: action === 'added',
  };
}

async function aggregateCommentReactions(
  commentIds: string[],
  viewerId: string | null,
): Promise<Map<string, { count: number; mine: boolean }>> {
  const out = new Map<string, { count: number; mine: boolean }>();
  if (commentIds.length === 0) return out;

  const counts = await db
    .select({
      commentId: communityTopicCommentReactions.commentId,
      count: sql<number>`count(*)::int`,
    })
    .from(communityTopicCommentReactions)
    .where(inArray(communityTopicCommentReactions.commentId, commentIds))
    .groupBy(communityTopicCommentReactions.commentId);

  for (const row of counts) {
    out.set(row.commentId, { count: row.count, mine: false });
  }

  if (viewerId) {
    const mine = await db
      .select({ commentId: communityTopicCommentReactions.commentId })
      .from(communityTopicCommentReactions)
      .where(
        and(
          inArray(communityTopicCommentReactions.commentId, commentIds),
          eq(communityTopicCommentReactions.userId, viewerId),
        ),
      );
    for (const m of mine) {
      const existing = out.get(m.commentId);
      if (existing) existing.mine = true;
      else out.set(m.commentId, { count: 0, mine: true });
    }
  }

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
      parentCommentId: communityTopicComments.parentCommentId,
      count: sql<number>`count(*)::int`,
    })
    .from(communityTopicComments)
    .where(inArray(communityTopicComments.parentCommentId, parentIds))
    .groupBy(communityTopicComments.parentCommentId);

  for (const r of rows) {
    if (r.parentCommentId) out.set(r.parentCommentId, r.count);
  }
  return out;
}

export async function createTopicComment(args: {
  topicId: string;
  authorId: string;
  body: string;
  parentCommentId?: string | null;
}): Promise<{ id: string; communityId: string }> {
  const body = args.body.trim();
  if (!body) throw new Error('empty_body');
  if (body.length > 2000) throw new Error('body_too_long');

  // Topic exists + the topic's community has the author as a member.
  const [topic] = await db
    .select({
      id: communityTopics.id,
      communityId: communityTopics.communityId,
      deletedAt: communityTopics.deletedAt,
    })
    .from(communityTopics)
    .where(eq(communityTopics.id, args.topicId))
    .limit(1);
  if (!topic) throw new Error('not_found');
  if (topic.deletedAt) throw new Error('topic_deleted');

  const [mem] = await db
    .select({ userId: communityMembers.userId })
    .from(communityMembers)
    .where(
      and(
        eq(communityMembers.communityId, topic.communityId),
        eq(communityMembers.userId, args.authorId),
      ),
    )
    .limit(1);
  if (!mem) throw new Error('not_a_member');

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(communityTopicComments)
      .values({
        topicId: args.topicId,
        parentCommentId: args.parentCommentId ?? null,
        authorId: args.authorId,
        body,
      })
      .returning({ id: communityTopicComments.id });

    await tx
      .update(communityTopics)
      .set({ commentCount: sql`${communityTopics.commentCount} + 1` })
      .where(eq(communityTopics.id, topic.id));

    await tx
      .update(communities)
      .set({ lastActivityAt: new Date() })
      .where(eq(communities.id, topic.communityId));

    return { id: row.id, communityId: topic.communityId };
  });
}
