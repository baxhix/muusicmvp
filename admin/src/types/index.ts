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
