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
  /** Flag de onboarding completo. FALSE pra contas recém-criadas
   *  pelo magic link (backend só seedou email + name=prefix);
   *  vira TRUE depois do POST /api/auth/onboarding rodar com
   *  birthDate, displayName, interests etc. Usado no verify
   *  step pra decidir entre /app (returning) e /auth/onboarding/
   *  birth-date (novo). */
  isOnboarded: boolean('is_onboarded').notNull().default(false),
  /** Marker pra idempotência do email de boas-vindas. Setado
   *  pela rota /api/auth/onboarding logo após persistir o
   *  is_onboarded. Próximas chamadas não reenviam. */
  welcomeEmailSentAt: timestamp('welcome_email_sent_at', {
    withTimezone: true,
  }),
  /** Data de nascimento (ISO date) preenchida no onboarding —
   *  obrigatória pra LGPD e age gating. Null pra contas
   *  pré-onboarding-flow. */
  birthDate: text('birth_date'),
  /** Cache da idade calculada no submit (evita recalcular toda
   *  vez). */
  age: integer('age'),
  /** Flag se o usuário é menor de idade (age < 18). Backend
   *  pode aplicar restrições de conteúdo / consentimento
   *  parental baseado nessa flag. */
  isMinor: boolean('is_minor').notNull().default(false),
  /** E-mail do responsável/pais — obrigatório pra contas de menores
   *  de idade (12–17). Recebe o aviso de que o filho se cadastrou. */
  parentEmail: text('parent_email'),
  /** Consentimento LGPD pra DERIVAR, ARMAZENAR e COMPARTILHAR a
   *  localização aproximada (city-level, jittered ~4km — nunca GPS
   *  exato). Sem este flag = true: o auto-sync não roda, o POST
   *  /api/me/location rejeita, e o usuário não aparece no mapa pra
   *  outros. Default false (opt-in afirmativo); a migration 0050
   *  faz grandfather (true) das contas que já tinham lat preenchido.
   *  Forçado false pra menores. Revogar zera lat/lng/city/country. */
  locationConsent: boolean('location_consent').notNull().default(false),
  /** Aceite de termos + privacidade — timestamp ISO. Null se
   *  ainda não aceitou (contas pré-onboarding-flow). */
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  /** Array de IDs de interesses selecionados no onboarding
   *  (pré-onboarding social). Serializado como text[] do
   *  postgres. */
  interests: text('interests').array(),
  /** Atribuição de aquisição — FK opcional pra
   * artist_signup_links.id. Setado no momento da criação do
   * user row, lendo o cookie `fanverse_ref` (cravado pelo
   * /r/[slug]). Null = signup orgânico (não veio de link de
   * artista). FK declarada no nível do SQL (migration) pra
   * evitar circular import com artistSignupLinks abaixo. */
  signupLinkId: uuid('signup_link_id'),
  /** Código de referral único e estável do usuário — base do
   *  loop viral. Compartilhado via /i/{code}. Gerado lazy em
   *  getOrCreateReferralCode() na primeira leitura, e backfillado
   *  pra contas existentes na migration 0049. UNIQUE permite
   *  múltiplos NULL (contas que nunca tiveram code gerado ainda),
   *  mas garante unicidade quando preenchido. */
  referralCode: text('referral_code').unique(),
  /** Quem convidou este usuário. Setado UMA vez na criação da
   *  conta, lendo o cookie `fanverse_invite` (cravado pelo
   *  /i/[code]). Self-reference; null = signup não-referido.
   *  ON DELETE SET NULL pra não derrubar a row do convidado se
   *  o referrer for removido (LGPD). */
  referredByUserId: uuid('referred_by_user_id').references(
    (): AnyPgColumn => users.id,
    { onDelete: 'set null' },
  ),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  /**
   * Soft delete — quando o usuário pede exclusão (LGPD art. 18),
   * marcamos `deletedAt` em vez de DELETE direto. Mantemos a row
   * por retenção legal (30-90 dias dependendo da reivindicação),
   * com PII anonimizada antes do hard delete final (cron job
   * futuro).
   *
   * Comportamento esperado:
   *   - getCurrentUser() filtra deletedAt IS NULL — soft-deleted
   *     não consegue logar.
   *   - Magic link request pra email soft-deleted é tratado como
   *     conta nova (cria outro user com mesmo email — único após
   *     anonimização final).
   *   - Listings (admin, autorias de posts, etc.) ainda mostram
   *     a row mas com badge "Usuário removido". Aplicar filtro
   *     nessas queries é próxima rodada.
   */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('users_deleted_at_idx').on(t.deletedAt),
]);

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
    /** OTP de 6 dígitos enviado no mesmo email do magic link
     *  como fallback (usuário pode clicar no link OU digitar o
     *  código). Só preenchido pra kind='magic'; null pra
     *  kind='session'. Index parcial em (code, kind) permite
     *  lookup eficiente em /api/auth/verify por {email, code}. */
    code: text('code'),
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
    /* Counters denormalizados (P0.2 da auditoria de chat) — mantidos
     * pelo write-side em sendMessage / addMember / removeMember / etc.
     * Substituem as subqueries correlacionadas no listConversationsForUser. */
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    lastMessageId: uuid('last_message_id'),
    memberCount: integer('member_count').notNull().default(0),
  },
  (t) => [
    unique('conversations_slug_unique').on(t.slug),
    index('conv_last_message_at_idx').on(t.lastMessageAt),
  ],
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
    /* Counter denormalizado de mensagens não lidas (P0.2). Atualizado
     * em sendMessage (incrementa para todos os outros), markRead
     * (zera para o user), addMember (zera no entry/re-entry). */
    unreadCount: integer('unread_count').notNull().default(0),
    /* Marcador de "usuário saiu do grupo". Não removemos a row
     * porque queremos que o user ainda VEJA o histórico (read-only)
     * com a badge "Você saiu" como última entrada. NULL = ativo,
     * pode postar. */
    leftAt: timestamp('left_at', { withTimezone: true }),
    /* "Apagar conversa pra mim" — esconde a conversa da lista do
     * user sem afetar a outra parte. Quando uma DM recebe nova
     * mensagem com created_at > hidden_at, a conversa reaparece
     * (comportamento estilo WhatsApp). Também limpado quando o
     * user reabre a conv via search → openDmWith. NULL = visível. */
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    /* Corte permanente do timeline. Mensagens com
     * `messages.created_at <= cleared_history_before` ficam
     * ocultas pra esse user PERMANENTEMENTE — não voltam quando
     * a conversa reaparece via search OU nova msg. Setado junto
     * com hidden_at no "apagar conversa", mas NUNCA limpado.
     * Equivale ao "clear history" do WhatsApp. */
    clearedHistoryBefore: timestamp('cleared_history_before', { withTimezone: true }),
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
    /* sender_id nullable + ON DELETE SET NULL (migration 0040 /
     * P2.1) — em hard-delete LGPD do user, preservamos o body da
     * mensagem mas zeramos o vínculo. Combinado com `senderDeleted`
     * o front renderiza "Usuário removido" no nome em vez de pôr
     * fora o histórico inteiro. */
    senderId: uuid('sender_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    body: text('body').notNull(),
    // Discriminator for system events (group created, member joined,
    // group renamed). 'user' is the only kind that goes through the
    // normal send pipeline + notifications; system kinds are injected
    // by the server-side group lifecycle hooks (createGroup, addMember)
    // and rendered as centered pill badges instead of bubbles.
    //
    // Kept open as `text` (not enum) so we can grow the catalog
    // without a schema migration each time.
    kind: text('kind').notNull().default('user'),
    /* Sentinela pro front renderizar "Usuário removido" no
     * sender name quando o user foi hard-deletado. NULL sender +
     * sender_deleted=true = LGPD-respected. */
    senderDeleted: boolean('sender_deleted').notNull().default(false),
    /* Anexos da mensagem (imagens). Array de `MessageAttachment`:
     *   { url, mimeType, size, width?, height? }
     *
     *   - `url`         path relativo servido pelo Next (`/uploads/chat/...`)
     *   - `mimeType`    MIME validado no upload (image/jpeg|png|webp|gif)
     *   - `size`        bytes
     *   - `width|height` dimensions em px (sniffed server-side no upload)
     *
     * NULL = mensagem text-only (caso comum). JSONB permite array
     * vazio também — defensivo no leitor que normaliza pra []. */
    attachments: jsonb('attachments'),
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
      enum: ['image', 'video', 'carousel', 'story', 'poll', 'sponsored', 'broadcast', 'audio', 'youtube_video', 'material_alert'],
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
 * Comentários por faixa/música — discussão temática sobre uma música
 * específica (ex.: "Eu Não Vou Mudar"). Flat (sem replies); soft-delete
 * via `deletedAt`. Os likes da faixa ficam em `trackLikes`.
 */
export const trackComments = pgTable(
  'track_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trackId: uuid('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('track_comments_track_created_idx').on(t.trackId, t.createdAt),
    index('track_comments_author_idx').on(t.authorId),
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
        /* Referral rewards (migration 0049). `referral_bonus` é
         *  creditado ao REFERRER quando o convidado ativa
         *  (completa onboarding); `referral_welcome` é o bônus
         *  de boas-vindas pro próprio convidado. A coluna é text
         *  puro (sem CHECK no banco), então o enum aqui é só o
         *  contrato TS. */
        'referral_bonus',
        'referral_welcome',
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
 * Editable point-per-kind table. Each row maps an `ActivityKind` to
 * the Fanpoints credit that recordActivity should award on insert.
 * The admin Fanpoints tab edits this surface; recordActivity reads
 * with a short cache so the change propagates within ~60s.
 *
 * The 7 rows seeded match the current ActivityKind enum (stream,
 * login, chat_started, post_liked, comment_posted, post_shared,
 * three_streams). When the enum grows, the seed and the admin UI
 * pick up the new kind automatically.
 *
 * Falls back to the hardcoded POINTS constant in
 * `src/server/activities/queries.ts` if a kind has no row (e.g.
 * during a partial migration). That keeps the runtime resilient
 * to the table being temporarily empty.
 */
export const fanpointRules = pgTable('fanpoint_rules', {
  kind: text('kind').primaryKey(),
  points: integer('points').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id, {
    onDelete: 'set null',
  }),
});

/**
 * Artist signup links — cada artista (ou campanha) tem um link
 * exclusivo (`/r/{slug}`) pra compartilhar nas redes. Usuários que
 * se cadastram via esse link ficam atribuídos ao artista pelo
 * campo `users.signup_link_id`.
 *
 * Fluxo:
 *   1. Admin cria um link em /admin/aquisicao → row em
 *      artist_signup_links com slug único (ex: "ana-castela").
 *   2. Visitante clica em muusic.live/r/ana-castela.
 *   3. /r/[slug] (em src/app/r/[slug]) seta cookie
 *      `fanverse_ref={slug}` (30 dias) e redireciona pra /teste.
 *   4. Visitante completa cadastro. Na criação do user row, o
 *      backend lê o cookie + busca o slug → grava signup_link_id.
 *   5. Admin vê em /admin/aquisicao/[id] quantos users vieram
 *      de cada link.
 *
 * `archivedAt` é soft-delete — links inativos param de receber
 * novos signups mas o histórico permanece pra atribuição.
 */
export const artistSignupLinks = pgTable('artist_signup_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  artistName: text('artist_name').notNull(),
  /** Rótulo interno opcional pra distinguir múltiplas campanhas
   * do mesmo artista (ex: "Story do Insta — semana 3"). */
  label: text('label'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: uuid('created_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

/**
 * Referrals — loop viral usuário→usuário (migration 0049).
 *
 * Cada row é UM convite atribuído: o referrer (dono do
 * `referral_code`) trouxe o referred (convidado). O modelo é
 * "um referral por convidado" (referredId UNIQUE) com máquina
 * de estados:
 *
 *   pending   → convidado criou a conta via /i/{code} mas ainda
 *               não ativou (não completou onboarding).
 *   activated → convidado completou onboarding. Disparamos o
 *               reward neste instante e já avançamos pra rewarded.
 *   rewarded  → FP creditado pro referrer (+ welcome pro
 *               convidado). Estado terminal — a transição
 *               pending→rewarded é atômica (UPDATE ... WHERE
 *               status='pending') pra garantir crédito único
 *               mesmo em corridas.
 *
 * Anti-fraude: reward só na ATIVAÇÃO (não no signup puro), 1
 * row por referred (UNIQUE), e self-referral bloqueado na
 * atribuição. `rewardPoints` denormaliza o valor creditado no
 * momento (audit), independente de mudanças futuras na regra.
 */
export const referrals = pgTable(
  'referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referrerId: uuid('referrer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** UNIQUE — um convidado só pode ser atribuído a um referrer.
     *  Garante idempotência da atribuição no signup. */
    referredId: uuid('referred_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Código usado, denormalizado pra auditoria mesmo se o
     *  referrer trocar de code no futuro. */
    code: text('code').notNull(),
    status: text('status', {
      enum: ['pending', 'activated', 'rewarded'],
    })
      .notNull()
      .default('pending'),
    rewardPoints: integer('reward_points'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    rewardedAt: timestamp('rewarded_at', { withTimezone: true }),
  },
  (t) => [
    index('referrals_referrer_idx').on(t.referrerId),
    index('referrals_status_idx').on(t.status),
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

/**
 * Documentos legais (Termos de Uso, Política de Privacidade)
 * por surface (site público, app, plataforma web).
 *
 * Schema com PK composta `(kind, surface)` — uma row por
 * combinação. Total: 6 rows fixas seeded (2 kinds × 3 surfaces).
 * O admin edita cada documento individualmente porque cada
 * surface costuma ter pequenas variações de copy (ex: termos do
 * app citam loja de aplicativos, termos da plataforma citam
 * artistas/criadores, termos do site cobrem visitantes).
 *
 *   - `surface`:
 *     - 'site'      — site público (/termos, /privacidade)
 *     - 'app'       — app (modal in-app no drawer do TopBar)
 *     - 'platform'  — plataforma web (artistas / criadores)
 *
 *   - `publishedAt` null = rascunho (não aparece no consumidor
 *     daquela surface). Cada surface tem fluxo de publicação
 *     independente — o admin pode publicar site sem mexer no app.
 *
 *   - `version` bumpa por publicação. Mostra "v.X publicada em Y"
 *     no admin UI.
 *
 * Migração 0044 trocou a PK simples (`kind`) por composta. As
 * 2 rows que existiam viraram surface='site' (default histórico).
 */
export const legalDocuments = pgTable(
  'legal_documents',
  {
    kind: text('kind', {
      enum: ['terms_of_use', 'privacy_policy'],
    }).notNull(),
    surface: text('surface', {
      enum: ['site', 'app', 'platform'],
    }).notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    version: integer('version').notNull().default(1),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: uuid('updated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.kind, t.surface] }),
  }),
);

/**
 * FAQ entries — perguntas e respostas que aparecem na seção FAQ
 * pública do site. CRUD vive em /admin/site/faq; o backend lista
 * publicadas (publishedAt NOT NULL) pra render do site público.
 *
 *   - `category` é texto livre por enquanto (ex: "Conta", "Pagamentos",
 *     "Privacidade"). Quando o produto crescer, vira FK pra uma
 *     tabela de categorias dedicada.
 *
 *   - `sortOrder` controla a posição. Por convenção, valores menores
 *     aparecem primeiro. Reordenação no admin atualiza o campo em
 *     todas as rows afetadas dentro de uma única transação.
 *
 *   - `publishedAt` é soft-publish: null = rascunho (não aparece no
 *     site), non-null = publicado. Mais semântico que um boolean
 *     porque já carrega a data de publicação pra timeline / SEO.
 */
export const faqEntries = pgTable(
  'faq_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    category: text('category'),
    sortOrder: integer('sort_order').notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedBy: uuid('updated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => ({
    /* Index por (sortOrder, createdAt) acelera o SELECT do site
     * público que ordena por sort_order asc e desempata por
     * data de criação. */
    faqOrderIdx: index('faq_entries_order_idx').on(t.sortOrder, t.createdAt),
  }),
);

/* ── Onboarding tour cards ───────────────────────────────────────
 *
 * Cards do tour de orientação in-app (deck animado mostrado ao
 * usuário no /app). Gerido pelo painel admin (CRUD em
 * /admin/onboarding); o app consome os publicados via
 * `GET /api/onboarding-tour`. Substitui o `DEFAULT_ONBOARDING_TOUR`
 * estático de src/lib/app/onboardingTourSteps.ts (que vira fallback).
 *
 * Mesma convenção do FAQ: `sortOrder` controla a ordem dos passos,
 * `publishedAt` é soft-publish (null = rascunho, não aparece pro
 * usuário). `decor` = 'globe' liga a decoração de bolhas; `anchor`
 * é reservado pro spotlight ancorado (Fase futura).
 */
export const onboardingTourCards = pgTable(
  'onboarding_tour_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    emoji: text('emoji'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    cta: text('cta').notNull(),
    decor: text('decor'),
    anchor: text('anchor'),
    sortOrder: integer('sort_order').notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedBy: uuid('updated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => ({
    onboardingTourOrderIdx: index('onboarding_tour_cards_order_idx').on(
      t.sortOrder,
      t.createdAt,
    ),
  }),
);

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

/**
 * Anti-spam pro cron de interações em comunidades. Cada (user,
 * community) que recebe um email aqui é gravado com sent_at; o
 * próximo run consulta antes de mandar de novo (cooldown 6h
 * default). Sem isto, um community quente acumulando interações
 * mandaria email a cada execução do cron.
 *
 * reason text: 'reply' (respondeu meu comment/topic), 'reaction'
 * (curtiu meu comment) ou 'viral' (10+ interações em 6h numa
 * comunidade onde comentei).
 */
export const communityNotificationLog = pgTable(
  'community_notification_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(), // 'reply' | 'reaction' | 'viral'
    sentAt: timestamp('sent_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('cnl_user_sent_idx').on(t.userId, t.sentAt),
    index('cnl_user_community_idx').on(t.userId, t.communityId, t.sentAt),
  ],
);

/* ──────────────────────────────────────────────────────────────
 * Materiais — acervo de conteúdo exclusivo da artista pros
 * superfãs. Árvore hierárquica: pastas + arquivos. Cada arquivo
 * carrega o binário no filesystem (uploads/materiais/) e os
 * metadados aqui. Audience controla quem pode acessar via tier.
 *
 * Self-referencing FK em parent_id permite estrutura recursiva.
 * onDelete: 'cascade' simplifica a exclusão — apagar uma pasta
 * remove todos os descendentes no DB sem código extra (o handler
 * ainda tem que limpar os arquivos físicos do disco).
 * ────────────────────────────────────────────────────────────── */
export const materialNodes = pgTable(
  'material_nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** 'folder' = container navegável; 'file' = item baixável. */
    type: text('type', { enum: ['folder', 'file'] }).notNull(),
    name: text('name').notNull(),
    /** null = raiz; senão referencia outro material_nodes (pasta). */
    parentId: uuid('parent_id').references(
      (): AnyPgColumn => materialNodes.id,
      { onDelete: 'cascade' },
    ),
    description: text('description'),

    /* ── Campos exclusivos de FILE (NULL pra folders) ───────── */
    /** Formato canônico do arquivo. Determina o ícone na UI. */
    formato: text('formato', {
      enum: ['jpg', 'png', 'svg', 'mp3', 'mp4', 'pdf', 'zip'],
    }),
    /** URL do binário original servido por /api/materiais/files/[filename]. */
    fileUrl: text('file_url'),
    /** URL do thumbnail 256×256 — pode ser data URL (base64),
     *  caminho /public/... ou outra URL servida pelo backend. */
    thumbUrl: text('thumb_url'),
    /** Filename canonical no filesystem. Usado pra deletar do
     *  disco quando o registro é removido. */
    filename: text('filename'),
    /** Bytes do binário original (não do thumb). */
    tamanhoBytes: integer('tamanho_bytes'),
    status: text('status', {
      enum: ['rascunho', 'publicado', 'agendado', 'arquivado'],
    }).default('publicado'),
    publicadoEm: timestamp('publicado_em', { withTimezone: true }),
    publishedToFeed: boolean('published_to_feed').notNull().default(false),
    downloads: integer('downloads').notNull().default(0),
    favoritos: integer('favoritos').notNull().default(0),
    /** Tier de audiência (Top 1/10/50/100/Todos) — controla
     *  visibilidade pros fãs. Folder não usa (NULL ok). */
    audience: text('audience', {
      enum: ['top1', 'top10', 'top50', 'top100', 'all'],
    }).default('all'),

    /** Admin que criou. NULL se o registro veio do seed. */
    createdById: uuid('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    /** Query mais comum: listar filhos de uma pasta — index em
     *  parent_id elimina full scan. */
    index('material_nodes_parent_idx').on(t.parentId),
    /** Filtros por tipo (separar pastas de arquivos no tree
     *  listing). */
    index('material_nodes_type_idx').on(t.type),
  ],
);

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type SiteTag = typeof siteTags.$inferSelect;
export type NewSiteTag = typeof siteTags.$inferInsert;
export type MaterialNode = typeof materialNodes.$inferSelect;
export type NewMaterialNode = typeof materialNodes.$inferInsert;
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

/* ──────────────────────────────────────────────────────────────
 * EMAIL — Templates, logs, campanhas.
 *
 * Pra que serve cada tabela:
 *   - `email_templates`: subject + HTML editáveis pelos emails do
 *     sistema (magic_link hoje, welcome/etc. futuros). Quando um
 *     send precisa do template, lê daqui; se não existir ou
 *     is_active=false, cai pro hardcoded em código. Garante que
 *     desativar o registro no DB é safe — emails continuam saindo.
 *   - `email_logs`: registro de TODO email que sai (sucesso ou
 *     falha). Audit trail + métricas. Linha gravada por
 *     `recordEmailSend()` em `src/server/email/log.ts`.
 *   - `email_campaigns`: broadcasts criados via admin. Estado de
 *     dispatch (draft → sending → sent), contadores parciais pra
 *     UI mostrar progresso, segmento + params.
 * ────────────────────────────────────────────────────────────── */

export const emailTemplates = pgTable('email_templates', {
  // `kind` é a primary-key natural (slug estável usado em código).
  // Ex.: 'magic_link', 'welcome', 'account_deleted'.
  kind: text('kind').primaryKey(),
  /** Nome amigável editável pelo admin. Quando null, GET cai
   *  pro `label` definido no KNOWN_TEMPLATES (ou pro próprio
   *  kind, se for template custom sem catálogo). */
  label: text('label'),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  /** Estrutura do editor visual (tema + blocos). Quando setado,
   *  o admin pode voltar a editar visualmente e o `html` foi
   *  gerado a partir desta estrutura. Null = template editado em
   *  HTML raw, sem round-trip pro visual. */
  design: jsonb('design'),
  // Quando false, fallback pro hardcoded em código — kill switch
  // se template no DB der ruim.
  isActive: boolean('is_active').notNull().default(true),
  /** Descrição livre exibida no admin (quando o template dispara). */
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id, {
    onDelete: 'set null',
  }),
});

export const emailLogs = pgTable(
  'email_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Email do destinatário — armazenado plain pra audit. LGPD:
     *  hard-delete junto com o user no cron de retenção. */
    to: text('to').notNull(),
    /** Same `kind` do template, ou 'campaign' pra broadcast, ou
     *  'manual_test' pra preview disparado pelo admin. */
    kind: text('kind').notNull(),
    subject: text('subject').notNull(),
    /** 'sent' | 'failed'. */
    status: text('status').notNull(),
    errorMessage: text('error_message'),
    /** FK opcional pra agrupar envios de uma mesma campanha. */
    campaignId: uuid('campaign_id'),
    sentAt: timestamp('sent_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Latência do call à API Resend (ms). Útil pra debugar
     *  degradação do upstream. */
    durationMs: integer('duration_ms'),
  },
  (t) => [
    index('email_logs_sent_at_idx').on(t.sentAt),
    index('email_logs_kind_idx').on(t.kind),
    index('email_logs_status_idx').on(t.status),
    index('email_logs_campaign_idx').on(t.campaignId),
  ],
);

export const emailCampaigns = pgTable('email_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  /** Segmento de destinatários:
   *  'all'         — todos os usuários ativos (deleted_at IS NULL)
   *  'superfans'   — top X% por fanpoints (params: { topPct })
   *  'inactive'    — sem login há N dias (params: { days })
   *  'city'        — usuários de uma cidade (params: { city })
   *  'custom_emails' — lista de emails fornecida (params: { emails })
   */
  segment: text('segment').notNull(),
  segmentParams: jsonb('segment_params'),
  /** 'draft' | 'sending' | 'sent' | 'failed' | 'canceled'. */
  status: text('status').notNull().default('draft'),
  /** Quando setado, o dispatcher só começa após esse instante. */
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  sentCount: integer('sent_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  totalRecipients: integer('total_recipients').notNull().default(0),
  createdBy: uuid('created_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Setado quando dispatcher termina (status virou 'sent' ou 'failed'). */
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type EmailLog = typeof emailLogs.$inferSelect;
export type NewEmailLog = typeof emailLogs.$inferInsert;
export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type NewEmailCampaign = typeof emailCampaigns.$inferInsert;

/**
 * Configurações globais de marca aplicadas a todos os emails:
 *   - logo URL (renderiza no header)
 *   - cores de marca (override do tema base)
 *   - footer com links institucionais + redes sociais
 *
 * Singleton: id=1 (CHECK no DB). Row pré-existe via seed.
 */
export const emailBrandSettings = pgTable('email_brand_settings', {
  id: integer('id').primaryKey().default(1),
  settings: jsonb('settings').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id, {
    onDelete: 'set null',
  }),
});

export type EmailBrandSettingsRow = typeof emailBrandSettings.$inferSelect;

/**
 * Catálogo de notificações disparadas pela plataforma (in-app +
 * email). O TIPO vive em código (KNOWN_NOTIFICATIONS em
 * src/server/notifications/catalog.ts); esta tabela só persiste
 * as escolhas do admin: on/off geral + on/off por canal.
 *
 * Tipos sem row no DB caem pros defaults definidos no catálogo.
 */
export const notificationSettings = pgTable('notification_settings', {
  kind: text('kind').primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  channels: jsonb('channels').notNull().default({}),
  /** Overrides editáveis — caem pro catálogo quando null. */
  labelOverride: text('label_override'),
  descriptionOverride: text('description_override'),
  triggerOverride: text('trigger_override'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id, {
    onDelete: 'set null',
  }),
});

export type NotificationSettingsRow = typeof notificationSettings.$inferSelect;
