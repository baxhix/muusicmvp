/* ============================================================
   Domain types — shared by mocks, services, and UI.
   When the backend is wired up, these are the contracts
   the API responses should match (or be mapped to).
   ============================================================ */

export type ID = string;
export type ISODate = string;

/* ── Users ─────────────────────────────────────────────────── */

export type UserRole = 'fan' | 'creator';
export type UserStatus = 'active' | 'suspended' | 'banned' | 'pending';
export type UserPlan = 'free' | 'plus' | 'superfan';
export type UserSex = 'M' | 'F' | 'Outro' | 'NaoInformado';

export interface Stream {
  title: string;
  artist?: string;
  playedAt: ISODate;
}

export interface User {
  id: ID;
  name: string;
  handle: string;
  email: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  plan: UserPlan;
  /** Cadastro principal mostrado na tela de Usuários */
  age: number;
  /** Data de nascimento ISO (YYYY-MM-DD) salva no onboarding.
   *  null quando o usuário não preencheu (legacy ou skip). */
  birthDate: string | null;
  sex: UserSex;
  phone: string;
  city: string;
  state: string;
  /** Streaming */
  lastStream?: Stream;
  streamHistory: Stream[];
  totalStreams: number;
  /** Engajamento (usado em outras telas — Superfãs/Dashboard) */
  fanpoints: number;
  level: number;
  totalSpentBRL: number;
  followers: number;
  following: number;
  posts: number;
  /** Auditoria */
  termsAcceptedAt: ISODate;
  createdAt: ISODate;
  lastActiveAt: ISODate;
  isOnline: boolean;
  verified?: boolean;
}

/* ── Admin Feed CMS ───────────────────────────────────────────
 * Distinct from the legacy `Post` type above (which models the
 * mocked "all posts on the platform" surface). These shapes mirror
 * `ApiFeedPost` on the public API + power the Admin > Feed module
 * end-to-end.
 *
 * `FeedItemType` already lists every format the backend's CHECK
 * constraint supports — the UI only enables 'image' for now, but
 * adding 'video' / 'story' / 'poll' / 'sponsored' / 'broadcast'
 * later doesn't need a type-system change. */

export type FeedItemType =
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

export type FeedItemStatus = 'published' | 'scheduled' | 'draft' | 'inactive';

export interface FeedMediaItem {
  url: string;
  alt?: string | null;
  /** 'video'   — clip uploaded via the /upload pipeline.
   *  'youtube' — URL externa de YouTube (embed iframe no client).
   *  absent ou 'image' — still image. */
  kind?: 'image' | 'video' | 'youtube';
  /** Optional poster (thumbnail) for video items. URL points to an
   *  image stored via the regular image upload pipeline. */
  poster?: string | null;
}

export interface FeedItem {
  id: ID;
  type: FeedItemType | null;
  status: FeedItemStatus | null;
  title: string | null;
  description: string | null;
  media: FeedMediaItem[];
  /** ISO timestamp — when scheduled. Null otherwise. */
  scheduledAt: string | null;
  /** ISO timestamp — when last (or first) published. Null otherwise. */
  publishedAt: string | null;
  /** ISO timestamp — when the post drops from the public feed.
   *  Null for permanent posts; non-null for stories (default 24h). */
  expiresAt: string | null;
  /** Soft-hide toggle independent of lifecycle status. */
  isActive: boolean;
  /** Number of non-deleted comments. Server-computed. */
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

/** Lifecycle directive that resolves to status + timestamps server-side. */
export type FeedItemAction = 'publish' | 'schedule' | 'draft';

/** Body shape accepted by POST /api/admin/feed and PATCH .../:id. */
export interface FeedItemInput {
  type?: FeedItemType;
  title?: string | null;
  description?: string | null;
  media?: FeedMediaItem[];
  scheduledAt?: string | null;
  /** When set, marks the story's drop-from-feed cutoff. Server
   *  fills now+24h when undefined on type='story'. Pass null to
   *  override that and make the story never expire. */
  expiresAt?: string | null;
  isActive?: boolean;
  action?: FeedItemAction;
}

/* ── Site tracking tags ───────────────────────────────────────
 * One row per third-party tag the platform injects globally —
 * Google Analytics, Google Tag Manager, Facebook Pixel,
 * Microsoft Clarity, TikTok Pixel, Hotjar. Edited from
 * /admin/settings → Tags, read server-side by the public layout. */
export type SiteTagKind =
  | 'analytics'  // Google Analytics 4 (G-XXXXXXX)
  | 'gtm'        // Google Tag Manager (GTM-XXXXXXX)
  | 'facebook'   // Meta Pixel (numeric pixel ID)
  | 'clarity'    // Microsoft Clarity (short alphanumeric)
  | 'tiktok'     // TikTok Pixel (CXXXXXX...)
  | 'hotjar'     // Hotjar (numeric HJID)
  | 'posthog';   // PostHog project key (phc_…) — drives Product Analytics

export interface SiteTag {
  kind: SiteTagKind;
  value: string;
  enabled: boolean;
  /** ISO timestamp of the last edit. */
  updatedAt: string;
  updatedBy: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
}

/* ── Moderation / Reports ─────────────────────────────────── */

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'nudity'
  | 'misinformation'
  | 'copyright'
  | 'other';

export type ReportStatus = 'open' | 'review' | 'resolved' | 'dismissed' | 'escalated';

type ReportTarget =
  | { kind: 'post'; postId: ID }
  | { kind: 'user'; userId: ID }
  | { kind: 'message'; messageId: ID };

export interface Report {
  id: ID;
  reporterId: ID;
  reporter: Pick<User, 'id' | 'name' | 'handle' | 'avatar'>;
  target: ReportTarget;
  targetSnapshot: {
    label: string;
    excerpt?: string;
    authorName?: string;
  };
  reason: ReportReason;
  description?: string;
  /** URL of an evidence image uploaded by the reporter (optional). */
  image?: string;
  status: ReportStatus;
  priority: 'low' | 'medium' | 'high';
  assignedTo?: { id: ID; name: string };
  createdAt: ISODate;
  resolvedAt?: ISODate;
}

/* ── Superfans ────────────────────────────────────────────── */

export interface Superfan {
  id: ID;
  user: Pick<User, 'id' | 'name' | 'handle' | 'avatar' | 'city' | 'state'>;
  rank: number;
  fanpoints: number;
  totalSpentBRL: number;
  totalListenMinutes: number;
  interactions: number;
  daysActive: number;
  joinedAt: ISODate;
  tags: string[];
  /** segment computed by the platform (e.g. "VIP", "Em ascensão") */
  segment: 'vip' | 'rising' | 'loyal' | 'new';
}

/* ── User Activity Log (compliance) ──────────────────────────
 *
 * One event per row in /admin/users/:id/activities. Designed for
 * compliance review (LGPD, audit trails, moderation history) — so
 * each row carries channel + IP + user-agent + result and the
 * category lets the operator filter to the slice they care about.
 *
 * The shape is intentionally broader than the actual production
 * `user_activities` table (which today only tracks stream / login
 * / chat_started). The extra categories are mocked client-side
 * for users who don't have real events yet; when the backend
 * grows to record auth / moderation / settings / compliance
 * events, the same shape just gets returned by /api/admin/users/:id/activities.
 */
export type UserActivityCategory =
  | 'auth'
  | 'session'
  | 'profile'
  | 'content'
  | 'streaming'
  | 'moderation'
  | 'settings'
  | 'compliance';

export type UserActivityResult = 'success' | 'failure' | 'pending';

export interface UserActivityEvent {
  id: ID;
  userId: ID;
  category: UserActivityCategory;
  /** Stable machine code, e.g. 'login_success', 'post_created',
   *  'account_suspended'. Used for grouping + CSV export. */
  action: string;
  /** Human-readable description (pt-BR) shown in the table. */
  description: string;
  timestamp: ISODate;
  result: UserActivityResult;
  ip?: string;
  userAgent?: string;
  channel?: 'web' | 'ios' | 'android' | 'api';
  city?: string;
  country?: string;
  /** Pointer to the object the action touched. Rendered as an
   *  inline pill in the table. */
  relatedEntity?: {
    type: 'post' | 'comment' | 'message' | 'user' | 'track' | 'conversation' | 'report';
    id: ID;
    label?: string;
  };
  /** Free-form diff or notes (e.g. "city: São Paulo → Rio de Janeiro").
   *  Rendered in the expanded row. */
  metadata?: Record<string, string | number | boolean | null>;
  /** Who performed the action when it wasn't the user themselves
   *  (e.g. moderator banning the account). Null on user-self
   *  actions. */
  actor?: {
    id: ID;
    name: string;
    role: 'self' | 'moderator' | 'system';
  };
}

/* ── Invite Codes (auth gating + viral loop) ────────────────
 *
 * Each row is a single 6-character alphanumeric code (A-Z + 0-9,
 * minus ambiguous chars like I/O/0/1) handed out to a user during
 * the magic-link / signup flow. When a code is redeemed, the
 * platform mints 4 fresh codes attributed to the new user (modeled
 * here via `childCodeIds`), creating the viral loop the product
 * wants.
 *
 * Phase 1 (this release) is CMS-only: codes register, the admin
 * sees the catalog + can mint more, but the auth flow on the
 * public app isn't wired yet. The data shape matches what the
 * eventual /api/admin/invites endpoint will return so the table
 * + drawer stay agnostic.
 */
export type InviteStatus = 'pending' | 'used' | 'expired' | 'revoked';

export interface InviteCode {
  id: ID;
  /** 6-char uppercase alphanumeric, e.g. "A8K2Z9". Pretty-printed
   *  with a dash mid-string in the UI ("A8K-2Z9") for readability. */
  code: string;
  status: InviteStatus;
  createdAt: ISODate;
  /** When the code expires + status flips to 'expired'. Null = no
   *  expiry. Defaults to now + 60 days in the generator. */
  expiresAt: ISODate | null;
  /** Who generated this code. Either an admin or the user who
   *  earned it through the viral loop. */
  createdBy: {
    id: ID;
    name: string;
    email: string;
    avatar?: string;
    /** 'admin' = minted by team, 'user' = earned via viral loop. */
    source: 'admin' | 'user';
  };
  /** Set when status='used'. */
  usedAt: ISODate | null;
  usedBy: {
    id: ID;
    name: string;
    email: string;
    avatar?: string;
  } | null;
  /** Viral loop: when a user redeems a code, the platform mints 4
   *  new ones for them and stamps them with that user as creator.
   *  This array points to the children of THIS code (i.e. set when
   *  this code itself was used). */
  childCodeIds: ID[];
  /** Pointer back up the tree — set on the 4 codes generated by
   *  this code's redemption. Null for admin-minted seed codes. */
  parentCodeId: ID | null;
  /** Optional free-form label admins use to tag a batch
   *  (e.g. "Beta wave 1", "Influencer push BR"). */
  note?: string;
}

/* ── Activity (recent log on dashboard) ───────────────────── */

export type ActivityType =
  | 'user.signup'
  | 'user.banned'
  | 'user.suspended'
  | 'post.published'
  | 'post.removed'
  | 'report.opened'
  | 'report.resolved'
  | 'payout.completed';

export interface ActivityEntry {
  id: ID;
  type: ActivityType;
  /** Categoria crua do backend (user_activities.kind), preservada
   *  além do `type` lossy pra a página de Atividade renderizar um
   *  badge de categoria coerente (stream/login/chat). */
  kind?: 'stream' | 'login' | 'chat_started';
  actor: { id: ID; name: string; avatar?: string } | null;
  subject: string;
  meta?: string;
  createdAt: ISODate;
}

/* ── Metrics ──────────────────────────────────────────────── */

export interface Kpi {
  id: string;
  label: string;
  value: number;
  /** ratio: 0.124 = +12.4% */
  trend: number | null;
  spark: number[];
  format: 'integer' | 'currency' | 'compact';
  helperText?: string;
}

export interface SeriesPoint {
  date: ISODate;
  value: number;
}

export interface ChartSeries {
  id: string;
  label: string;
  data: SeriesPoint[];
}

/* ── Pagination wrapper (forward-compat with API responses) ── */

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/* ── Settings: Team ───────────────────────────────────────── */

export type TeamRole = 'owner' | 'admin' | 'moderator' | 'readonly';

export interface TeamMember {
  id: ID;
  name: string;
  email: string;
  avatar?: string;
  role: TeamRole;
  invitedAt: ISODate;
  lastActiveAt: ISODate;
  twoFactor: boolean;
  status: 'active' | 'invited';
  /** Grupos da sidebar (Plataforma, Superfãs, Growth, Site, Sistema)
   *  + entradas top-level (Dashboard, Usuários) aos quais este membro
   *  tem acesso/visualização. undefined = acesso total (legacy). */
  groupAccess?: string[];
}

/* ── Settings: Workspace (Geral) ──────────────────────────── */

export interface WorkspaceSettings {
  name: string;
  slug: string;
  language: 'pt-BR' | 'en-US' | 'es-ES';
  timezone: string;
  description?: string;
}

/* ── Communities (forum CMS) ──────────────────────────────────
 *
 * Shapes the admin Communities surface consumes. These mirror the
 * server interfaces in src/server/communities/admin.ts; the backend
 * is the source of truth, the types here only narrow what the
 * admin UI uses for rendering.
 */

export interface AdminCommunity {
  id: ID;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  creatorId: ID | null;
  creatorName: string | null;
  creatorEmail: string | null;
  creatorAvatar: string | null;
  memberCount: number;
  topicCount: number;
  /** Sum of non-deleted comments across all topics in this community. */
  commentCount: number;
  lastActivityAt: ISODate;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface AdminCommunityMember {
  userId: ID;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  joinedAt: ISODate;
  isCreator: boolean;
}

export interface AdminCommunityTopic {
  id: ID;
  communityId: ID;
  title: string;
  body: string | null;
  authorId: ID | null;
  authorName: string | null;
  authorEmail: string | null;
  authorAvatar: string | null;
  commentCount: number;
  deletedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface AdminCommunityTopicComment {
  id: ID;
  topicId: ID;
  parentCommentId: ID | null;
  body: string;
  deletedAt: ISODate | null;
  createdAt: ISODate;
  author: {
    id: ID | null;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  reactionCount: number;
}
