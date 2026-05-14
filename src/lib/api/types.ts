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

export interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
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
    | 'group_added';
  sourceUserId: string | null;
  trackId: string | null;
  artist: string | null;
  album: string | null;
  conversationId: string | null;
  messageId: string | null;
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
