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
 * Notifications for "same music" matches and chat events.
 * `payload` keeps shape flexible per `kind` without schema churn.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', {
      enum: ['same_track', 'same_artist', 'same_album', 'message', 'mention'],
    }).notNull(),
    sourceUserId: uuid('source_user_id').references(() => users.id, { onDelete: 'cascade' }),
    trackId: uuid('track_id').references(() => tracks.id, { onDelete: 'set null' }),
    artist: text('artist'),
    album: text('album'),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'cascade',
    }),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'cascade' }),
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
    kind: text('kind', {
      enum: ['stream', 'login', 'chat_started'],
    }).notNull(),
    points: integer('points').notNull(),
    trackId: uuid('track_id').references(() => tracks.id, { onDelete: 'set null' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
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
