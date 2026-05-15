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

/* ── Posts (Feed) ─────────────────────────────────────────── */

export type PostType = 'audio' | 'image' | 'video' | 'text';
export type PostStatus = 'published' | 'draft' | 'review' | 'removed';

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
  | 'broadcast';

export type FeedItemStatus = 'published' | 'scheduled' | 'draft' | 'inactive';

export interface FeedMediaItem {
  url: string;
  alt?: string | null;
  /** 'video' on uploaded clips; absent (or 'image') for stills.
   *  Used by the renderer to pick `<video>` vs `<img>` and by the
   *  admin to badge each tile. */
  kind?: 'image' | 'video';
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

export interface Post {
  id: ID;
  authorId: ID;
  author: Pick<User, 'id' | 'name' | 'handle' | 'avatar' | 'verified'>;
  type: PostType;
  status: PostStatus;
  title?: string;
  body: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  tags: string[];
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    plays?: number;
  };
  pinned?: boolean;
  reportedCount: number;
  publishedAt: ISODate;
  updatedAt: ISODate;
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

export type ReportTarget =
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
}

/* ── Settings: Integrations ───────────────────────────────── */

export type IntegrationCategory = 'music' | 'payments' | 'maps' | 'analytics' | 'comms';

export interface Integration {
  id: ID;
  name: string;
  description: string;
  category: IntegrationCategory;
  connected: boolean;
  connectedAt?: ISODate;
  scope?: string[];
}

/* ── Settings: API Keys ───────────────────────────────────── */

export interface ApiKey {
  id: ID;
  label: string;
  prefix: string;
  createdAt: ISODate;
  lastUsedAt?: ISODate;
  scopes: string[];
  createdBy: string;
}

/* ── Settings: Billing ────────────────────────────────────── */

export type BillingPlanId = 'starter' | 'growth' | 'enterprise';

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  monthlyBRL: number;
  seats: number;
  seatsUsed: number;
  nextChargeAt: ISODate;
  paymentMethod: {
    brand: string;
    last4: string;
    expiresAt: string;
  };
}

export interface BillingInvoice {
  id: ID;
  number: string;
  date: ISODate;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
}

/* ── Settings: Workspace (Geral) ──────────────────────────── */

export interface WorkspaceSettings {
  name: string;
  slug: string;
  language: 'pt-BR' | 'en-US' | 'es-ES';
  timezone: string;
  description?: string;
}

/* ── Algorithm Rules ──────────────────────────────────────────
 * Admin-managed IF/THEN behaviour catalog. Each rule encodes
 * "when <trigger> matches, dispatch <action>". Registered through
 * /admin/algoritmo; consumed (later) by the player-side engine.
 * Phase 1 ships the CMS only.
 *
 * The trigger + action vocabularies are closed — adding a new
 * value requires a code change + migration. That friction is
 * intentional: no rule on the books that the engine can't run.
 */

export const ALGORITHM_TRIGGER_EVENTS = [
  'session_started',
  'idle_in_screen',
  'feed_scroll_streak',
  'track_completed',
  'track_skipped',
  'time_in_app_minutes',
  'consecutive_inactive_days',
] as const;

export type AlgorithmTriggerEvent = (typeof ALGORITHM_TRIGGER_EVENTS)[number];

export const ALGORITHM_ACTION_KINDS = [
  'show_toast',
  'nudge_to_screen',
  'inject_recommendation',
  'show_modal',
] as const;

export type AlgorithmActionKind = (typeof ALGORITHM_ACTION_KINDS)[number];

/** Form-field descriptor used by the composer to render the
 *  per-trigger / per-action config inputs. Mirrors the server
 *  `ConfigField`. */
export type AlgorithmConfigField =
  | { kind: 'string';  label: string; helper: string; defaultValue: string;  maxLength?: number }
  | { kind: 'number';  label: string; helper: string; defaultValue: number;  min?: number; max?: number }
  | { kind: 'boolean'; label: string; helper: string; defaultValue: boolean }
  | { kind: 'enum';    label: string; helper: string; options: string[];     defaultValue: string };

export interface AlgorithmCatalogEntry {
  label: string;
  helper: string;
  fields: Record<string, AlgorithmConfigField>;
}

export interface AlgorithmRule {
  id: ID;
  name: string;
  description: string;
  triggerEvent: AlgorithmTriggerEvent;
  triggerConfig: Record<string, unknown>;
  actionKind: AlgorithmActionKind;
  actionConfig: Record<string, unknown>;
  serviceName: string | null;
  targetObject: string | null;
  tags: string[];
  documentationUrl: string | null;
  enabled: boolean;
  priority: number;
  cooldownSeconds: number;
  maxPerSession: number;
  createdAt: ISODate;
  updatedAt: ISODate;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
}

/** Body shape accepted by POST and PATCH. Partial — the server
 *  applies the patch with "undefined = leave alone" semantics. */
export interface AlgorithmRuleInput {
  name?: string;
  description?: string;
  triggerEvent?: AlgorithmTriggerEvent;
  triggerConfig?: Record<string, unknown>;
  actionKind?: AlgorithmActionKind;
  actionConfig?: Record<string, unknown>;
  serviceName?: string | null;
  targetObject?: string | null;
  tags?: string[];
  documentationUrl?: string | null;
  enabled?: boolean;
  priority?: number;
  cooldownSeconds?: number;
  maxPerSession?: number;
}
