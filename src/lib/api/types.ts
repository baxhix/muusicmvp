/**
 * Wire types — shapes returned by the muusic REST API.
 * Kept in one place so client hooks stay consistent with the server routes
 * in src/app/api/.
 */

export interface ApiUser {
  id: string;
  email: string;
  name: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
  avatarUrl: string | null;
  role: 'user' | 'admin';
  /** Flag de onboarding completo. False pra contas recém-criadas
   *  via magic link que ainda precisam preencher birth-date /
   *  profile / interests. Verify page usa pra decidir entre
   *  /app (returning) e /auth/onboarding/birth-date (novo). */
  isOnboarded: boolean;
}

export interface ApiOnlineUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  nowPlaying: { title: string; artist: string; youtubeId: string } | null;
}

export interface ApiSearchUser {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  city: string | null;
}

export interface ApiConversationSummary {
  id: string;
  type: 'dm' | 'group';
  /** Group display name. Null for DMs (use otherUser.name instead). */
  name?: string | null;
  /** Group avatar URL (user-uploaded). Null for DMs. */
  imageUrl?: string | null;
  /** UUID of the user who created the group. Null for DMs + system rooms. */
  createdBy?: string | null;
  /** Requesting user's role inside this conversation. */
  myRole?: 'owner' | 'admin' | 'member';
  /**
   * Quando setado (ISO string), o user atual SAIU desse grupo
   * (ou foi kickado). Pode continuar lendo o histórico em modo
   * read-only, mas o composer fica desabilitado e um banner
   * "Você saiu do grupo e não pode mais enviar mensagens" aparece.
   */
  myLeftAt?: string | null;
  /** Total participant count — drives the "X membros" line in the dock + panel header. */
  memberCount?: number;
  createdAt: string;
  lastMessage: {
    id: string;
    body: string;
    senderId: string;
    createdAt: string;
  } | null;
  otherUser: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    /**
     * True for verified accounts (currently only the fake Ana Castela
     * fixture, but the schema is here for real verification later).
     * Drives the blue check badge on chat dock / sidebar / panel
     * header avatars.
     */
    verified?: boolean;
  } | null;
  /** Messages received in this thread that the current user hasn't read yet. */
  unreadCount: number;
}

/** Aggregated reaction shown next to a message (one entry per emoji). */
export interface ApiMessageReaction {
  emoji: string;
  count: number;
  /** Whether the requesting user is among the reactors for this emoji. */
  mine: boolean;
}

/**
 * Imagem anexada a uma mensagem de chat (DM ou grupo).
 *
 *   - `url`         path relativo servido pelo Next ('/uploads/chat/...')
 *   - `mimeType`    validado no upload (image/jpeg|png|webp|gif)
 *   - `size`        bytes
 *   - `width|height` dimensions em px (sniffed server-side no upload —
 *                   permite reservar slot e evitar layout shift)
 *
 * Persistido na coluna `messages.attachments` JSONB (migration 0046).
 */
export interface ApiMessageAttachment {
  url: string;
  mimeType: string;
  size: number;
  width?: number | null;
  height?: number | null;
}

export interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  /**
   * Discriminator for system events (group created, member joined,
   * group renamed, etc.). Defaults to 'user' for normal messages
   * typed by users — the front-end renders those as bubbles. Any
   * other value triggers the centered-pill system-message branch.
   */
  kind?: string;
  /** Hydrated by listMessages / sendMessage via JOIN with users. */
  senderName?: string | null;
  senderEmail?: string | null;
  senderAvatarUrl?: string | null;
  /**
   * Aggregated reactions ordered by the first time each emoji appeared
   * on the message. Defaults to [] when omitted by the server (e.g. on
   * a freshly-broadcast message before anyone reacts).
   */
  reactions?: ApiMessageReaction[];
  /**
   * Anexos da mensagem (imagens). Vazio/omitido em mensagens text-only.
   * Renderer mostra grid de thumbnails abaixo do `body` no bubble.
   */
  attachments?: ApiMessageAttachment[];
}

/**
 * Minimal participant shape used for the avatar-stack preview in the
 * Superchat header. The full participant rows (with email, city, etc.)
 * are fetched separately by ParticipantsModal.
 */
/** One row in the group roster returned by GET /api/conversations/:id/members. */
export interface ApiGroupMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface ApiSuperchatParticipantPreview {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

/** Shape returned by /api/users/:id/profile — drives ProfilePanel. */
export interface ApiUserProfile {
  id: string;
  name: string | null;
  /** Only present when the caller is viewing their own profile. */
  email: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  avatarUrl: string | null;
  fanpoints: number;
  streams: number;
  isOnline: boolean;
  nowPlaying: {
    trackId: string;
    title: string;
    artist: string;
    youtubeId: string | null;
  } | null;
}

export interface ApiSuperchatResponse {
  conversation: {
    id: string;
    type: 'group';
    name: string | null;
    slug: string | null;
  };
  messages: ApiMessage[];
  hasMore: boolean;
  participantCount: number;
  participantPreviews: ApiSuperchatParticipantPreview[];
}

export interface ApiSuperchatParticipant {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  city: string | null;
  joinedAt: string;
  lastSeenAt: string | null;
}

export interface ApiNotification {
  id: string;
  userId: string;
  kind:
    | 'same_track'
    | 'same_artist'
    | 'same_album'
    | 'message'
    | 'mention'
    | 'group_added'
    | 'comment_reaction'
    | 'comment_reply'
    | 'comment_mention'
    // User waved a heart at another user from the map. The
    // notification row has sourceUserId set to the sender; the
    // recipient (this notification's userId) is who gets the
    // hearts cascade on receipt.
    | 'waved';
  sourceUserId: string | null;
  trackId: string | null;
  artist: string | null;
  album: string | null;
  conversationId: string | null;
  messageId: string | null;
  feedPostId: string | null;
  commentId: string | null;
  payload: unknown;
  createdAt: string;
  readAt: string | null;
  /** Hydrated by listNotifications via JOIN with users. */
  sourceUser: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
  /** Hydrated by listNotifications via JOIN with tracks. */
  track: {
    id: string;
    title: string;
    artist: string;
    youtubeId: string;
  } | null;
}

export interface ApiLocation {
  city: string;
  country: string | null;
  countryCode: string | null;
  lat: number;
  lng: number;
}

export interface ApiHistoryItem {
  trackId: string;
  title: string;
  artist: string;
  youtubeId: string;
  /** ISO timestamp of the most recent listen. */
  lastPlayedAt: string;
  /** Total plays of this track by the user. */
  plays: number;
  /** Whether the user has liked this track. */
  liked: boolean;
}

export interface ApiRankingRow {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  streams: number;
  logins: number;
  chatsStarted: number;
  points: number;
}

export type ApiActivityKind = 'stream' | 'login' | 'chat_started';

/* ── Feed CMS (admin + public) ─────────────────────────────────── */

export type ApiFeedPostType =
  | 'image'
  | 'video'
  | 'carousel'
  | 'story'
  | 'poll'
  | 'sponsored'
  | 'broadcast'
  | 'audio'
  | 'youtube_video';

export type ApiFeedPostStatus = 'published' | 'scheduled' | 'draft' | 'inactive';

export interface ApiFeedMediaItem {
  url: string;
  alt?: string | null;
  /** 'video'   — clip uploaded via /upload pipeline (<video src>).
   *  'youtube' — URL externa de YouTube (renderer embute via iframe).
   *  absent ou 'image' — still. */
  kind?: 'image' | 'video' | 'youtube';
  /** Optional poster (thumbnail) for video items. Falls back to the
   *  video's first frame in the browser when absent. */
  poster?: string | null;
}

/**
 * One feed post as returned by both:
 *   - `/api/feed/posts` (public, status=published+isActive only)
 *   - `/api/admin/feed`  (admin, all states)
 *
 * The shape is identical because the public list is just a filtered
 * subset of the admin list — keeping a single client type means the
 * public renderer reuses the same media-rendering code path that the
 * admin preview uses.
 */
export interface ApiFeedPost {
  id: string;
  type: ApiFeedPostType | null;
  status: ApiFeedPostStatus | null;
  title: string | null;
  description: string | null;
  media: ApiFeedMediaItem[];
  scheduledAt: string | null;
  publishedAt: string | null;
  /** ISO timestamp — when the post drops from the public feed.
   *  Null for permanent posts; set on stories. */
  expiresAt: string | null;
  isActive: boolean;
  /** Number of non-deleted comments on this post. Computed
   *  server-side; clients use this for the comment-count badge
   *  without doing an extra fetch per post. */
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
}

/**
 * One row in a feed post's comment thread. Used for both top-level
 * comments and inline replies — the discriminator is
 * `parentCommentId`: null → top-level, set → reply.
 *
 *   - `replyCount` is `null` on replies (we deliberately keep
 *     threads flat — no nested replies — so a reply can't have its
 *     own reply count).
 *   - `deletedAt !== null` is the soft-delete signal. The UI renders
 *     "Comentário removido" in place of body; the author + avatar
 *     can still be shown so the thread doesn't look broken.
 */
export interface ApiFeedComment {
  id: string;
  postId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: string;
  deletedAt: string | null;
  author: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  reactions: {
    /** Total ❤️ count across all users. */
    count: number;
    /** Whether the requesting user is among the reactors. */
    mine: boolean;
  };
  /** Number of replies on this comment. Null for replies themselves. */
  replyCount: number | null;
}

/** Page returned by GET /api/feed/posts/:postKey/comments. */
export interface ApiFeedCommentsPage {
  /** Resolved feed_posts.id — clients store this for follow-up calls. */
  postId: string;
  items: ApiFeedComment[];
  hasMore: boolean;
  /** ISO timestamp of the oldest item. Pass back as ?before= for the next page. */
  nextCursor: string | null;
}

/** Result of POSTing a reaction toggle. */
export interface ApiFeedCommentReactionResult {
  action: 'added' | 'removed';
  count: number;
  mine: boolean;
}

export interface ApiActivityItem {
  id: string;
  kind: ApiActivityKind;
  points: number;
  /** ISO timestamp. */
  createdAt: string;
  trackTitle: string | null;
  trackArtist: string | null;
  conversationSlug: string | null;
}

/* ── Communities (forum) ───────────────────────────────────── */

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

export interface ApiCommunityMemberPreview {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface ApiCommunityDetail extends ApiCommunityCard {
  isCreator: boolean;
  /** Up to 5 most-recent members for the avatar-stack preview. */
  memberPreviews: ApiCommunityMemberPreview[];
  /** Creator mini avatar — drives the "by …" badge in the header. */
  creator: ApiCommunityMemberPreview | null;
}

export interface ApiCommunityMember {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  joinedAt: string;
  isCreator: boolean;
}

export interface ApiCommunityTopic {
  id: string;
  communityId: string;
  title: string;
  body: string | null;
  authorId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  authorAvatar: string | null;
  commentCount: number;
  createdAt: string;
  deletedAt: string | null;
}

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
    email: string | null;
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

/** Result of POSTing a reaction toggle on a topic comment. */
export interface ApiCommunityCommentReactionResult {
  action: 'added' | 'removed';
  count: number;
  mine: boolean;
}

