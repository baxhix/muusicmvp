import {
  pgTable,
  text,
  uuid,
  timestamp,
  doublePrecision,
  integer,
  boolean,
  jsonb,
  primaryKey,
  index,
  unique,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  // Approx city-level location (jittered server-side; never exact GPS).
  city: text('city'),
  country: text('country'),
  countryCode: text('country_code'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  avatarUrl: text('avatar_url'),
  // 'admin' grants access to /admin and admin-only endpoints.
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
});

/**
 * Stores both magic-link tokens and session tokens. Distinguished by `kind`.
 * `magic` tokens are single-use (consumed_at) with short TTL (~15min).
 * `session` tokens persist longer (~30d) and are the cookie value (hashed here).
 */
export const tokens = pgTable(
  'tokens',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['magic', 'session'] }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tokens_user_kind_idx').on(t.userId, t.kind)],
);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type', { enum: ['dm', 'group'] }).notNull().default('dm'),
    // For named/global rooms (e.g. 'superchat'). Null for DMs.
    slug: text('slug'),
    name: text('name'),
    // Custom group avatar (user-uploaded). Null for DMs + named
    // rooms; user-created groups POST one via the same upload
    // pipeline as user avatars / report images.
    imageUrl: text('image_url'),
    // Who created the group. Null for DMs + system-created rooms
    // like the global Superchat. Used to default the 'owner' role
    // on the participants row + drive "only owner can delete" checks.
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('conversations_slug_unique').on(t.slug)],
);

export const conversationParticipants = pgTable(
  'conversation_participants',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Role within the conversation. DMs are always 'member' both
    // sides. Groups default new joiners to 'member'; the creator
    // is stamped 'owner' at create time. 'admin' is a future role
    // for delegated moderation.
    role: text('role', { enum: ['owner', 'admin', 'member'] })
      .notNull()
      .default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    lastReadMessageId: uuid('last_read_message_id'),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index('cp_user_idx').on(t.userId),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('msg_conv_created_idx').on(t.conversationId, t.createdAt)],
);

/**
 * Per-(message, user, emoji) reaction marker. One row exists only when
 * the user has that reaction active; toggling off deletes the row.
 * The unique constraint guarantees a user can hold each emoji on a
 * given message exactly once.
 */
export const messageReactions = pgTable(
  'message_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('message_reactions_unique').on(t.messageId, t.userId, t.emoji),
    index('message_reactions_message_idx').on(t.messageId),
  ],
);

/**
 * Canonical track catalog. Seeded with NowPlaying.tsx discography on first migration.
 * youtubeId is the natural key for de-dup.
 */
export const tracks = pgTable(
  'tracks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    artist: text('artist').notNull(),
    album: text('album'),
    youtubeId: text('youtube_id').notNull().unique(),
    durationSeconds: integer('duration_seconds'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tracks_artist_idx').on(t.artist),
    index('tracks_album_idx').on(t.album),
  ],
);

/**
 * Live "now playing" state per user. Single row per user (PK = userId).
 * Upserted by the player every few seconds; cleared on stop/idle.
 */
export const nowPlaying = pgTable(
  'now_playing',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    trackId: uuid('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    positionSeconds: integer('position_seconds').notNull().default(0),
    isPaused: boolean('is_paused').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('np_track_idx').on(t.trackId)],
);

/**
 * Append-only listening log. Closed (endedAt set) when user changes track or stops.
 */
export const listeningHistory = pgTable(
  'listening_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    trackId: uuid('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationListenedSeconds: integer('duration_listened_seconds').notNull().default(0),
    completed: boolean('completed').notNull().default(false),
  },
  (t) => [
    index('lh_user_started_idx').on(t.userId, t.startedAt),
    index('lh_track_started_idx').on(t.trackId, t.startedAt),
  ],
);

/**
 * Feed posts. Today the feed renders mock data from FeedPanel.tsx,
 * but the comments system has to attach to a stable identifier per
 * post — so we lazy-insert a row here the first time anyone
 * interacts with a post, keyed by a deterministic `postKey` slug
 * (derived from the post's media src).
 *
 * Real user-authored posts (later) will share this table; the
 * `authorUserId` FK is nullable so the current Central Ana Castela
 * mocks can sit here under "no author".
 */
/**
 * Feed posts. Two shapes share this table:
 *
 *   1) "Bridge" rows: created by getOrCreateFeedPost() to anchor
 *      comments on the mock feed entries in FeedPanel.tsx. These
 *      only carry `postKey` + maybe `authorUserId`; the CMS fields
 *      stay null. The public listing query ignores them.
 *
 *   2) "CMS" rows: created from /admin/feed by Central Ana Castela.
 *      `type`, `status`, `description`, `media`, scheduling fields
 *      are set; `postKey` stays null. These are what
 *      `GET /api/feed/posts` returns to drive the real public feed.
 *
 * Splitting bridge vs CMS by null vs not-null status keeps the
 * comments/reactions/notifications wiring untouched while the CMS
 * grows on top.
 */
export const feedPosts = pgTable(
  'feed_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Nullable since 0008: only mock bridge rows carry a postKey.
    postKey: text('post_key'),
    // Original author of the post. For CMS rows this is the admin
    // who created the post (set by the create endpoint); for bridge
    // rows this stays null.
    authorUserId: uuid('author_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    // CMS-only fields ──
    type: text('type', {
      enum: ['image', 'video', 'carousel', 'story', 'poll', 'sponsored', 'broadcast', 'audio'],
    }),
    status: text('status', {
      enum: ['published', 'scheduled', 'draft', 'inactive'],
    }),
    title: text('title'),
    description: text('description'),
    // Array of { url, alt? }. Order is significant — carousel slides
    // render in array order.
    media: jsonb('media'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    /** Ephemeral cutoff for stories. NULL on permanent posts;
     *  set on stories to drop them from the public feed after the
     *  window passes (default 24h, override-able by the composer). */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('feed_posts_post_key_unique').on(t.postKey),
    index('feed_posts_status_published_idx').on(t.status, t.publishedAt),
    index('feed_posts_status_scheduled_idx').on(t.status, t.scheduledAt),
    index('feed_posts_status_updated_idx').on(t.status, t.updatedAt),
    index('feed_posts_expires_at_idx').on(t.expiresAt),
  ],
);

/**
 * Feed comments. Adjacency-list threading via parentCommentId — null
 * for top-level, set for replies. Soft delete via deletedAt so the
 * thread doesn't lose its shape when a parent is removed.
 */
export const feedComments = pgTable(
  'feed_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => feedPosts.id, { onDelete: 'cascade' }),
    // Self-FK; cascade so hard-deleting a parent cleans up replies too
    // (admin moderation). The product surface uses soft delete instead.
    parentCommentId: uuid('parent_comment_id'),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('feed_comments_post_created_idx').on(t.postId, t.createdAt),
    index('feed_comments_parent_created_idx').on(t.parentCommentId, t.createdAt),
    index('feed_comments_author_idx').on(t.authorId),
  ],
);

/**
 * One row per (comment, user, emoji). MVP UI only ever fires ❤️,
 * but the schema keeps emoji explicit so we can add more (😂 🔥 etc.)
 * without churn. Single row per user per emoji enforced by the
 * unique constraint, so the toggle stays idempotent.
 */
export const feedCommentReactions = pgTable(
  'feed_comment_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => feedComments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull().default('❤️'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('feed_comment_reactions_unique').on(t.commentId, t.userId, t.emoji),
    index('feed_comment_reactions_comment_idx').on(t.commentId),
  ],
);

/**
 * Notifications for "same music" matches, chat events, and feed
 * comment events. `payload` keeps shape flexible per `kind` without
 * schema churn. `feedPostId` + `commentId` are nullable FKs used by
 * the comment_* kinds so the bell can deep-link straight to the
 * post + scroll to the right comment.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', {
      enum: [
        'same_track',
        'same_artist',
        'same_album',
        'message',
        'mention',
        'group_added',
        'comment_reaction',
        'comment_reply',
        'comment_mention',
        // User waved a heart at another user from their map marker.
        // sourceUserId = sender, userId = recipient. No extra refs
        // (no track/conversation/etc.) — the payload is just
        // "<source> waved at you".
        'waved',
      ],
    }).notNull(),
    sourceUserId: uuid('source_user_id').references(() => users.id, { onDelete: 'cascade' }),
    trackId: uuid('track_id').references(() => tracks.id, { onDelete: 'set null' }),
    artist: text('artist'),
    album: text('album'),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'cascade',
    }),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'cascade' }),
    feedPostId: uuid('feed_post_id').references(() => feedPosts.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id').references(() => feedComments.id, { onDelete: 'cascade' }),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => [
    index('notif_user_unread_idx').on(t.userId, t.readAt),
    index('notif_user_created_idx').on(t.userId, t.createdAt),
  ],
);

/**
 * User likes on tracks. Composite primary key (user, track) so the same
 * pair can't appear twice; deleting a row unlikes.
 */
export const trackLikes = pgTable(
  'track_likes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    trackId: uuid('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.trackId] }),
    index('track_likes_user_created_idx').on(t.userId, t.createdAt),
    index('track_likes_track_idx').on(t.trackId),
  ],
);

/**
 * Append-only ledger of point-bearing activities. The user's total score
 * is just SUM(points) over this table — single source of truth, no
 * denormalized counter to drift.
 *
 * `kind`:
 *   - 'stream'        → started a new track (100 pts)
 *   - 'login'         → magic-link verified, session created (50 pts)
 *   - 'chat_started'  → opened a fresh DM with someone (200 pts)
 *
 * `trackId` / `conversationId` are optional context — set when the
 * activity is about a specific track or conversation.
 */
export const userActivities = pgTable(
  'user_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /* `kind` extended (migration 0010) with the four new reward
     * kinds for the engagement-points spec:
     *   post_liked      — heart on a feed post (chapéu)
     *   comment_posted  — top-level comment or reply created
     *   post_shared     — share/send arrow on a feed post
     *   three_streams   — bonus awarded every time the user's
     *                     stream count hits a multiple of 3
     * `stream` (the existing per-track award) is now worth 0
     * points server-side so it just keeps the ledger row for
     * counting purposes; the 10-pt reward comes via
     * `three_streams`. */
    kind: text('kind', {
      enum: [
        'stream',
        'login',
        'chat_started',
        'post_liked',
        'comment_posted',
        'post_shared',
        'three_streams',
      ],
    }).notNull(),
    points: integer('points').notNull(),
    trackId: uuid('track_id').references(() => tracks.id, { onDelete: 'set null' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    /** Optional pointer to the feed post that triggered this row.
     *  Lets us audit "who liked / shared / commented this post"
     *  without a separate junction table. NULL for activity kinds
     *  unrelated to feed posts (stream, login, chat_started, etc.). */
    postId: uuid('post_id').references(() => feedPosts.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('user_activities_user_created_idx').on(t.userId, t.createdAt),
    index('user_activities_kind_idx').on(t.kind),
  ],
);

/**
 * User-submitted reports. Created from anywhere a "Denunciar" button
 * exists in the app (today: chat kebab menu); later: post overflow,
 * profile overflow, etc.
 *
 * `target_user_id` is the user being reported. `reporter_id` is who
 * filed it. `image_url` is optional — same upload pipeline as
 * `users.avatar_url` but writes to a dedicated reports directory so
 * the two storages stay logically separated.
 *
 * `status` defaults to 'open'; admin moderation flips it through
 * 'resolved' / 'dismissed' / 'escalated'. Indexed on status +
 * created_at so the admin list view stays fast as the queue grows.
 */
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Source surface — 'chat_user' today; future: 'post', 'profile'. */
    source: text('source').notNull(),
    /** Free-text description (optional — UI marks the field optional). */
    description: text('description'),
    /** Public URL to an attached evidence image (optional). */
    imageUrl: text('image_url'),
    status: text('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    index('reports_status_idx').on(t.status),
    index('reports_created_at_idx').on(t.createdAt),
    index('reports_target_user_id_idx').on(t.targetUserId),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Track = typeof tracks.$inferSelect;
export type NowPlaying = typeof nowPlaying.$inferSelect;
export type ListeningHistoryRow = typeof listeningHistory.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type TrackLike = typeof trackLikes.$inferSelect;
export type UserActivity = typeof userActivities.$inferSelect;
/**
 * Third-party analytics / tracking tag configuration. One row per
 * kind (the natural key). Edited from /admin/settings → Tags, read
 * server-side by the public layout. `enabled=false` pauses the tag
 * without losing the value.
 */
export const siteTags = pgTable('site_tags', {
  kind: text('kind', {
    enum: ['analytics', 'gtm', 'facebook', 'clarity', 'tiktok', 'hotjar', 'posthog'],
  }).primaryKey(),
  value: text('value').notNull().default(''),
  enabled: boolean('enabled').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedById: uuid('updated_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
});

/* ── Communities (foruns) ────────────────────────────────────────
 *
 * User-created communities. Anyone with ≥10k Fanpoints can spawn
 * one; the membership and topics live on dedicated tables below.
 *
 * `slug` is the URL-friendly key the frontend routes off — unique
 * across all communities. `memberCount` + `topicCount` are
 * denormalized counters maintained by the server queries so the
 * list view can sort by "trending" without aggregating on every
 * request. `lastActivityAt` ticks every time a topic / comment
 * is created, which the trending sort also uses.
 */
export const communities = pgTable(
  'communities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    memberCount: integer('member_count').notNull().default(1),
    topicCount: integer('topic_count').notNull().default(0),
    /** Last topic or comment activity — drives the "Bombando" sort. */
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('communities_creator_idx').on(t.creatorId),
    index('communities_activity_idx').on(t.lastActivityAt),
  ],
);

/* ── Community membership ─────────────────────────────────────── */
export const communityMembers = pgTable(
  'community_members',
  {
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.communityId, t.userId] }),
    index('community_members_user_idx').on(t.userId),
  ],
);

/* ── Topics ──────────────────────────────────────────────────────
 *
 * A topic is a thread inside a community. The body is optional —
 * the title alone is enough to bootstrap a thread, like Reddit's
 * "ask a question" pattern. Comments live on a separate table
 * (community_topic_comments) and follow the same shape feed
 * comments use, so the frontend CommentsPanel pattern is
 * portable. `commentCount` is denormalized for list rendering. */
export const communityTopics = pgTable(
  'community_topics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    body: text('body'),
    commentCount: integer('comment_count').notNull().default(0),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('community_topics_community_idx').on(t.communityId, t.createdAt),
    index('community_topics_author_idx').on(t.authorId),
  ],
);

/* ── Topic comments ──────────────────────────────────────────────
 *
 * Comments + replies on a topic. Same shape as `feedComments`
 * (parent_comment_id self-reference for one level of nesting,
 * soft-delete via deletedAt) so the frontend can reuse the
 * existing CommentItem / CommentInput primitives with just a
 * different API base URL. */
export const communityTopicComments = pgTable(
  'community_topic_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => communityTopics.id, { onDelete: 'cascade' }),
    parentCommentId: uuid('parent_comment_id').references(
      (): AnyPgColumn => communityTopicComments.id,
      { onDelete: 'cascade' },
    ),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('community_topic_comments_topic_idx').on(t.topicId, t.createdAt),
    index('community_topic_comments_parent_idx').on(t.parentCommentId),
  ],
);

/**
 * Reactions on a topic comment. Mirrors `feed_comment_reactions` —
 * one row per (comment, user, emoji). MVP UI only fires ❤️ but the
 * schema is emoji-agnostic so we can add 😂 🔥 etc. without churn.
 */
export const communityTopicCommentReactions = pgTable(
  'community_topic_comment_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => communityTopicComments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull().default('❤️'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('community_topic_comment_reactions_unique').on(
      t.commentId,
      t.userId,
      t.emoji,
    ),
    index('community_topic_comment_reactions_comment_idx').on(t.commentId),
  ],
);

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type SiteTag = typeof siteTags.$inferSelect;
export type NewSiteTag = typeof siteTags.$inferInsert;
export type FeedPost = typeof feedPosts.$inferSelect;
export type NewFeedPost = typeof feedPosts.$inferInsert;
export type FeedComment = typeof feedComments.$inferSelect;
export type NewFeedComment = typeof feedComments.$inferInsert;
export type FeedCommentReaction = typeof feedCommentReactions.$inferSelect;
export type NewFeedCommentReaction = typeof feedCommentReactions.$inferInsert;
export type Community = typeof communities.$inferSelect;
export type NewCommunity = typeof communities.$inferInsert;
export type CommunityMember = typeof communityMembers.$inferSelect;
export type NewCommunityMember = typeof communityMembers.$inferInsert;
export type CommunityTopic = typeof communityTopics.$inferSelect;
export type NewCommunityTopic = typeof communityTopics.$inferInsert;
export type CommunityTopicComment = typeof communityTopicComments.$inferSelect;
export type NewCommunityTopicComment = typeof communityTopicComments.$inferInsert;
export type CommunityTopicCommentReaction =
  typeof communityTopicCommentReactions.$inferSelect;
export type NewCommunityTopicCommentReaction =
  typeof communityTopicCommentReactions.$inferInsert;
