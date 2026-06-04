import {
  and,
  desc,
  eq,
  gt,
  ilike,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { db } from '../db';
import {
  feedPosts,
  feedComments,
  users,
  type FeedPost,
} from '../db/schema';

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
  | 'broadcast'
  | 'audio'
  | 'youtube_video'
  | 'material_alert';
export type FeedStatus = 'published' | 'scheduled' | 'draft' | 'inactive';

export interface FeedMediaItem {
  url: string;
  alt?: string | null;
  /** 'video'   — clip subido via upload pipeline (<video src>).
   *  'youtube' — URL externa de YouTube (renderer embute via iframe).
   *  absent / 'image' — still image. */
  kind?: 'image' | 'video' | 'youtube';
  /** Optional poster (thumbnail) for video items. URL points to an
   *  image stored via the regular image upload pipeline. */
  poster?: string | null;
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
  /** Ephemeral cutoff used by stories. Null for permanent posts. */
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Number of non-deleted comments. Computed via a correlated
   *  subquery in selectWithAuthor() so listing endpoints can show
   *  the real count next to the comment icon without an extra
   *  fetch per post. */
  commentCount: number;
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
  /** ISO timestamp — when the post should drop from the public feed.
   *  Composer fills it with now+24h for story posts. Null for
   *  permanent content. */
  expiresAt?: string | null;
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

/**
 * Validador frouxo de URL do YouTube — aceita os 3 formatos canônicos
 * (watch, youtu.be, embed). Não tenta resolver / fetchar — só checa
 * que o host bate. O renderer extrai o videoId via regex; URLs
 * malformadas viram render do raw link em vez de embed.
 */
export function isYoutubeUrl(value: string): boolean {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    return (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtu.be' ||
      host === 'youtube-nocookie.com'
    );
  } catch {
    return false;
  }
}

function asMedia(value: unknown): FeedMediaItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> =>
      typeof v === 'object' && v !== null && typeof (v as { url?: unknown }).url === 'string',
    )
    .map((v) => {
      const kindRaw = v.kind;
      const kind: 'image' | 'video' | 'youtube' | undefined =
        kindRaw === 'video' || kindRaw === 'image' || kindRaw === 'youtube'
          ? kindRaw
          : undefined;
      return {
        url: v.url as string,
        alt: typeof v.alt === 'string' ? v.alt : null,
        kind,
        poster: typeof v.poster === 'string' ? v.poster : null,
      };
    });
}

function hydrate(row: FeedPost & {
  authorName: string | null;
  authorEmail: string | null;
  authorAvatarUrl: string | null;
  commentCount: number;
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
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    // Defensive: the subquery returns 0 for posts with no comments,
    // but during a fresh row insert the count may briefly be null
    // before any commit lands.
    commentCount: Number(row.commentCount ?? 0),
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
  // Comment count as a correlated subquery. Excludes soft-deleted
  // rows (deleted_at IS NOT NULL). Cheaper than a GROUP BY join on
  // a feed where each post commonly carries a handful of comments,
  // and keeps the row shape stable (no risk of duplicate rows from
  // a misconfigured aggregate). The result is hydrated as
  // `comment_count` and surfaced to ApiFeedPost.commentCount.
  const commentCount = sql<number>`(
    SELECT COUNT(*)::int FROM ${feedComments}
    WHERE ${feedComments.postId} = ${feedPosts.id}
      AND ${feedComments.deletedAt} IS NULL
  )`.as('comment_count');

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
      expiresAt: feedPosts.expiresAt,
      isActive: feedPosts.isActive,
      createdAt: feedPosts.createdAt,
      updatedAt: feedPosts.updatedAt,
      authorName: users.name,
      authorEmail: users.email,
      authorAvatarUrl: users.avatarUrl,
      commentCount,
    })
    .from(feedPosts)
    .leftJoin(users, eq(users.id, feedPosts.authorUserId));
}

/**
 * Resolve a lifecycle directive (publish / schedule / draft) into the
 * three stored fields. Stays here, not in the route, so future
 * callers (a cron job, a bulk action) hit the same rules.
 */
/**
 * Resolve the `expires_at` value for a post.
 *
 *   - Type = 'story':
 *       - admin passed an explicit date → use it (validated client-side
 *         for future-only by the date input).
 *       - admin passed null / undefined → default to now + 24h.
 *   - Any other type:
 *       - admin passed a date → respected (rare; e.g. a campaign-bound
 *         sponsored post).
 *       - undefined → null (no expiry).
 *       - null → null (explicit clear).
 */
function resolveExpiresAt(
  type: FeedType | undefined,
  raw: string | null | undefined,
): Date | null {
  if (type === 'story') {
    if (raw === null) return null; // explicit "never expire" override
    if (raw === undefined) {
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) throw new Error('invalid_expires_date');
    return dt;
  }
  if (raw === undefined || raw === null) return null;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) throw new Error('invalid_expires_date');
  return dt;
}

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
  // Per-type media validation — keeps the rule colocated with the
  // type assignment so adding a new format is one place to touch.
  if (input.type === 'image' && media.length === 0) {
    throw new Error('image_required');
  }
  if (input.type === 'video') {
    const video = media.find((m) => m.kind === 'video');
    if (!video) throw new Error('video_required');
  }
  if (input.type === 'youtube_video') {
    /* Posts do tipo YouTube precisam de pelo menos UM media item
     * com kind='youtube' + url válida do YouTube. O renderer no
     * cliente extrai o videoId da url e embute via iframe. */
    const yt = media.find((m) => m.kind === 'youtube');
    if (!yt) throw new Error('youtube_url_required');
    if (!isYoutubeUrl(yt.url)) throw new Error('youtube_url_invalid');
  }
  if (input.type === 'story' && media.length === 0) {
    throw new Error('story_media_required');
  }
  if (input.description && input.description.length > 2200) {
    throw new Error('description_too_long');
  }
  if (input.title && input.title.length > 200) {
    throw new Error('title_too_long');
  }

  const resolved = applyAction(input.action ?? 'draft', input.scheduledAt ?? null);
  const expiresAt = resolveExpiresAt(input.type, input.expiresAt);

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
      expiresAt,
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
  if (input.expiresAt !== undefined) {
    patch.expiresAt = input.expiresAt
      ? new Date(input.expiresAt)
      : null;
    if (patch.expiresAt && Number.isNaN((patch.expiresAt as Date).getTime())) {
      throw new Error('invalid_expires_date');
    }
  }

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
  args: { limit?: number; offset?: number; type?: FeedType } = {},
): Promise<HydratedAdminFeedPost[]> {
  const safeLimit = Math.min(Math.max(args.limit ?? 30, 1), 100);
  const safeOffset = Math.max(args.offset ?? 0, 0);

  const rows = await selectWithAuthor()
    .where(
      and(
        eq(feedPosts.status, 'published'),
        eq(feedPosts.isActive, true),
        isNotNull(feedPosts.publishedAt),
        lte(feedPosts.publishedAt, new Date()),
        // Drop ephemeral content whose window has passed. NULL = never
        // expires (all non-story posts default to this).
        or(
          isNull(feedPosts.expiresAt),
          gt(feedPosts.expiresAt, new Date()),
        ),
        args.type ? eq(feedPosts.type, args.type) : undefined,
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
