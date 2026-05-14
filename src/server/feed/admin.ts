import {
  and,
  desc,
  eq,
  ilike,
  isNotNull,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { db } from '../db';
import { feedPosts, users, type FeedPost } from '../db/schema';

/**
 * Admin feed CMS server module.
 *
 *   - createFeedPost        — admin creates a post (draft/scheduled/published)
 *   - updateFeedPost        — admin edits an existing post
 *   - listAdminFeedPosts    — paginated admin listing with filters
 *   - getAdminFeedPost      — single CMS post + author hydration
 *   - publishFeedPost       — flips status → 'published', stamps publishedAt
 *   - schedulePostFeedPost  — flips status → 'scheduled', validates future date
 *   - togglePostActive      — flips is_active (acts as "soft hide")
 *   - deleteFeedPost        — hard delete (cascades comments/reactions/notifs)
 *   - publishDueScheduled   — sweep hook: due `scheduled` posts → `published`
 *
 * Public read path (`listPublicFeedPosts`) is kept here too so admin
 * + public stay co-located — both touch the same row shape and the
 * same indexes.
 *
 * Status state machine:
 *
 *      draft ──publish──▶ published ──toggle──▶ inactive
 *        │      │              ▲                    │
 *        │   schedule        publish               toggle
 *        ▼      │              │                    ▼
 *    scheduled ─┴──due─────────┘                published
 *
 * is_active is orthogonal — it lets the admin temporarily hide a
 * published post without losing the publish timestamp.
 */

export type FeedType =
  | 'image'
  | 'video'
  | 'carousel'
  | 'story'
  | 'poll'
  | 'sponsored'
  | 'broadcast';
export type FeedStatus = 'published' | 'scheduled' | 'draft' | 'inactive';

export interface FeedMediaItem {
  url: string;
  alt?: string | null;
}

export interface HydratedAdminFeedPost {
  id: string;
  type: FeedType | null;
  status: FeedStatus | null;
  title: string | null;
  description: string | null;
  media: FeedMediaItem[];
  scheduledAt: string | null;
  publishedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
}

/** Inputs accepted by both create + update. Update treats undefined
 *  as "leave alone" and null as "clear". */
export interface FeedPostInput {
  type?: FeedType;
  title?: string | null;
  description?: string | null;
  media?: FeedMediaItem[];
  /** ISO timestamp. Required when status='scheduled'. */
  scheduledAt?: string | null;
  isActive?: boolean;
  /**
   * Lifecycle directive. The state machine resolves the actual
   * stored status + publishedAt + scheduledAt fields:
   *   - 'publish'  → status='published', publishedAt=now
   *   - 'schedule' → status='scheduled', scheduledAt=<input>, publishedAt=null
   *   - 'draft'    → status='draft', publishedAt=null, scheduledAt=null
   */
  action?: 'publish' | 'schedule' | 'draft';
}

// ── Helpers ──────────────────────────────────────────────────────

function asMedia(value: unknown): FeedMediaItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is { url: string; alt?: string | null } =>
      typeof v === 'object' && v !== null && typeof (v as { url?: unknown }).url === 'string',
    )
    .map((v) => ({
      url: v.url,
      alt: typeof v.alt === 'string' ? v.alt : null,
    }));
}

function hydrate(row: FeedPost & {
  authorName: string | null;
  authorEmail: string | null;
  authorAvatarUrl: string | null;
}): HydratedAdminFeedPost {
  return {
    id: row.id,
    type: (row.type as FeedType | null) ?? null,
    status: (row.status as FeedStatus | null) ?? null,
    title: row.title,
    description: row.description,
    media: asMedia(row.media),
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    author: row.authorUserId
      ? {
          id: row.authorUserId,
          name: row.authorName,
          email: row.authorEmail ?? '',
          avatarUrl: row.authorAvatarUrl,
        }
      : null,
  };
}

function selectWithAuthor() {
  return db
    .select({
      id: feedPosts.id,
      postKey: feedPosts.postKey,
      authorUserId: feedPosts.authorUserId,
      type: feedPosts.type,
      status: feedPosts.status,
      title: feedPosts.title,
      description: feedPosts.description,
      media: feedPosts.media,
      scheduledAt: feedPosts.scheduledAt,
      publishedAt: feedPosts.publishedAt,
      isActive: feedPosts.isActive,
      createdAt: feedPosts.createdAt,
      updatedAt: feedPosts.updatedAt,
      authorName: users.name,
      authorEmail: users.email,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(feedPosts)
    .leftJoin(users, eq(users.id, feedPosts.authorUserId));
}

/**
 * Resolve a lifecycle directive (publish / schedule / draft) into the
 * three stored fields. Stays here, not in the route, so future
 * callers (a cron job, a bulk action) hit the same rules.
 */
function applyAction(
  action: FeedPostInput['action'],
  scheduledAt: string | null | undefined,
): {
  status: FeedStatus;
  scheduledAt: Date | null;
  publishedAt: Date | null;
} {
  if (action === 'publish') {
    return { status: 'published', scheduledAt: null, publishedAt: new Date() };
  }
  if (action === 'schedule') {
    if (!scheduledAt) throw new Error('schedule_requires_date');
    const dt = new Date(scheduledAt);
    if (Number.isNaN(dt.getTime())) throw new Error('invalid_schedule_date');
    if (dt.getTime() <= Date.now()) throw new Error('schedule_in_past');
    return { status: 'scheduled', scheduledAt: dt, publishedAt: null };
  }
  // Default = draft
  return { status: 'draft', scheduledAt: null, publishedAt: null };
}

// ── CRUD ─────────────────────────────────────────────────────────

export async function createFeedPost(
  adminId: string,
  input: FeedPostInput,
): Promise<HydratedAdminFeedPost> {
  if (!input.type) input.type = 'image';
  const media = input.media ?? [];
  if (input.type === 'image' && media.length === 0) {
    throw new Error('image_required');
  }
  if (input.description && input.description.length > 2200) {
    throw new Error('description_too_long');
  }
  if (input.title && input.title.length > 200) {
    throw new Error('title_too_long');
  }

  const resolved = applyAction(input.action ?? 'draft', input.scheduledAt ?? null);

  const [row] = await db
    .insert(feedPosts)
    .values({
      authorUserId: adminId,
      type: input.type,
      status: resolved.status,
      title: input.title ?? null,
      description: input.description ?? null,
      media,
      scheduledAt: resolved.scheduledAt,
      publishedAt: resolved.publishedAt,
      isActive: input.isActive ?? true,
    })
    .returning({ id: feedPosts.id });

  const found = await getAdminFeedPost(row.id);
  if (!found) throw new Error('post_not_found');
  return found;
}

export async function updateFeedPost(
  postId: string,
  input: FeedPostInput,
): Promise<HydratedAdminFeedPost> {
  const [current] = await db
    .select({
      status: feedPosts.status,
      type: feedPosts.type,
      scheduledAt: feedPosts.scheduledAt,
      publishedAt: feedPosts.publishedAt,
    })
    .from(feedPosts)
    .where(eq(feedPosts.id, postId))
    .limit(1);
  if (!current) throw new Error('post_not_found');

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (input.type !== undefined) patch.type = input.type;
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.media !== undefined) patch.media = input.media;
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  if (input.action) {
    const resolved = applyAction(input.action, input.scheduledAt ?? null);
    patch.status = resolved.status;
    patch.scheduledAt = resolved.scheduledAt;
    // Preserve original publishedAt on re-edit of an already-published post
    // unless the action explicitly changes it (e.g. back to draft).
    patch.publishedAt =
      resolved.status === 'published'
        ? (current.publishedAt ?? resolved.publishedAt)
        : resolved.publishedAt;
  } else if (input.scheduledAt !== undefined && current.status === 'scheduled') {
    // Just nudging the scheduled time on an already-scheduled post.
    const dt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (dt && Number.isNaN(dt.getTime())) throw new Error('invalid_schedule_date');
    if (dt && dt.getTime() <= Date.now()) throw new Error('schedule_in_past');
    patch.scheduledAt = dt;
  }

  await db.update(feedPosts).set(patch).where(eq(feedPosts.id, postId));

  const found = await getAdminFeedPost(postId);
  if (!found) throw new Error('post_not_found');
  return found;
}

export async function getAdminFeedPost(
  postId: string,
): Promise<HydratedAdminFeedPost | null> {
  const [row] = await selectWithAuthor()
    .where(eq(feedPosts.id, postId))
    .limit(1);
  return row ? hydrate(row) : null;
}

export async function deleteFeedPost(postId: string): Promise<boolean> {
  const result = await db
    .delete(feedPosts)
    .where(eq(feedPosts.id, postId))
    .returning({ id: feedPosts.id });
  return result.length > 0;
}

/**
 * Flip status → 'published' (stamping publishedAt=now) regardless of
 * prior state. Used by the "Publicar agora" button on the listing
 * row + by the due-scheduled sweeper.
 */
export async function publishFeedPostNow(
  postId: string,
): Promise<HydratedAdminFeedPost> {
  await db
    .update(feedPosts)
    .set({
      status: 'published',
      publishedAt: new Date(),
      scheduledAt: null,
      updatedAt: new Date(),
    })
    .where(eq(feedPosts.id, postId));
  const found = await getAdminFeedPost(postId);
  if (!found) throw new Error('post_not_found');
  return found;
}

export async function setPostActive(
  postId: string,
  isActive: boolean,
): Promise<HydratedAdminFeedPost> {
  await db
    .update(feedPosts)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(feedPosts.id, postId));
  const found = await getAdminFeedPost(postId);
  if (!found) throw new Error('post_not_found');
  return found;
}

// ── Listings ─────────────────────────────────────────────────────

export interface AdminListFilters {
  status?: FeedStatus | 'all';
  type?: FeedType | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listAdminFeedPosts(
  filters: AdminListFilters = {},
): Promise<{ items: HydratedAdminFeedPost[]; total: number }> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  // CMS rows only — bridge rows have status=null and are filtered out
  // by the existing index (and by status='draft|scheduled|published|inactive').
  const where = and(
    isNotNull(feedPosts.status),
    filters.status && filters.status !== 'all'
      ? eq(feedPosts.status, filters.status)
      : undefined,
    filters.type && filters.type !== 'all'
      ? eq(feedPosts.type, filters.type)
      : undefined,
    filters.search?.trim()
      ? or(
          ilike(feedPosts.title, `%${filters.search.trim()}%`),
          ilike(feedPosts.description, `%${filters.search.trim()}%`),
        )
      : undefined,
  );

  const [rows, totalRow] = await Promise.all([
    selectWithAuthor()
      .where(where)
      .orderBy(desc(feedPosts.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedPosts)
      .where(where),
  ]);

  return {
    items: rows.map(hydrate),
    total: totalRow[0]?.count ?? 0,
  };
}

/**
 * Public feed listing. Filters:
 *   - status='published'
 *   - is_active=true
 *   - published_at IS NOT NULL AND published_at <= now()
 *
 * Returns newest-first, paginated. Authors are hydrated so the
 * client can show "Central Ana Castela" + avatar alongside the post.
 */
export async function listPublicFeedPosts(
  limit = 30,
  offset = 0,
): Promise<HydratedAdminFeedPost[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safeOffset = Math.max(offset, 0);

  const rows = await selectWithAuthor()
    .where(
      and(
        eq(feedPosts.status, 'published'),
        eq(feedPosts.isActive, true),
        isNotNull(feedPosts.publishedAt),
        lte(feedPosts.publishedAt, new Date()),
      ),
    )
    .orderBy(desc(feedPosts.publishedAt))
    .limit(safeLimit)
    .offset(safeOffset);
  return rows.map(hydrate);
}

/**
 * Auto-publish sweeper. Flips every scheduled post whose
 * `scheduledAt` has passed into status='published'. Safe to call
 * from a cron / lazy "on every public feed read" trigger — returns
 * the IDs that were rolled forward so callers can log them.
 *
 * Implemented as a single SQL UPDATE to avoid a read-then-write
 * race when two requests fire at the same boundary instant.
 */
export async function publishDueScheduled(): Promise<string[]> {
  const updated = await db
    .update(feedPosts)
    .set({
      status: 'published',
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(feedPosts.status, 'scheduled'),
        isNotNull(feedPosts.scheduledAt),
        lte(feedPosts.scheduledAt, new Date()),
      ),
    )
    .returning({ id: feedPosts.id });
  return updated.map((u) => u.id);
}
