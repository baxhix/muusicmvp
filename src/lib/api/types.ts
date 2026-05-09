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
  } | null;
}

export interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
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
}

export interface ApiNotification {
  id: string;
  userId: string;
  kind: 'same_track' | 'same_artist' | 'same_album' | 'message' | 'mention';
  sourceUserId: string | null;
  trackId: string | null;
  artist: string | null;
  album: string | null;
  conversationId: string | null;
  messageId: string | null;
  payload: unknown;
  createdAt: string;
  readAt: string | null;
}

export interface ApiLocation {
  city: string;
  country: string | null;
  countryCode: string | null;
  lat: number;
  lng: number;
}
