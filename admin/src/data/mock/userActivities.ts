import type {
  ID,
  User,
  UserActivityCategory,
  UserActivityEvent,
  UserActivityResult,
} from '@/types';

/**
 * Deterministic activity-log generator for the user details page.
 *
 * The real backend only logs stream/login/chat_started today (see
 * `user_activities` table). For the compliance / audit screen we
 * need a richer picture: auth attempts, moderation events,
 * profile edits, settings changes, etc. Until those start being
 * recorded server-side, this mock fills the gap.
 *
 * Determinism note: each call seeds an LCG from the user id so
 * loading the same user's page produces the same event list. That
 * matters for screenshots, repeated visits, and any "this should
 * look identical" review flow. When a real /api/admin/users/:id/
 * activities endpoint ships, callers swap this for a fetch — the
 * UserActivityEvent shape stays the same.
 */

/* ── Reusable libraries (drawn from at random with the LCG) ── */

const CITIES_BR = [
  'São Paulo - SP',  'Rio de Janeiro - RJ',  'Belo Horizonte - MG',
  'Salvador - BA',   'Brasília - DF',        'Fortaleza - CE',
  'Curitiba - PR',   'Porto Alegre - RS',    'Recife - PE',
  'Manaus - AM',     'Goiânia - GO',         'Florianópolis - SC',
];

const USER_AGENTS = [
  'Chrome 128 · macOS 14',
  'Chrome 128 · Windows 11',
  'Safari 17 · macOS 14',
  'Safari 17 · iPhone iOS 17',
  'Chrome 128 · Android 14',
  'Firefox 130 · Ubuntu',
  'Edge 128 · Windows 11',
];

const CHANNELS: UserActivityEvent['channel'][] = ['web', 'ios', 'android'];

/* ── Action catalog ──────────────────────────────────────────
 *
 * Each entry knows its category, a friendly description template,
 * and (optionally) generators for the entity it points at + the
 * diff / metadata payload. The weight controls how often the
 * action shows up in the generated stream. */

interface ActionDef {
  category: UserActivityCategory;
  action: string;
  description: (rnd: () => number) => string;
  weight: number;
  /** Most actions succeed; this overrides for actions where failure
   *  is plausibly common (e.g. login_attempt). */
  failureRate?: number;
  /** Hooks for related entity + metadata if the action has one. */
  buildEntity?: (rnd: () => number) => UserActivityEvent['relatedEntity'];
  buildMetadata?: (rnd: () => number) => UserActivityEvent['metadata'];
  /** When true, the actor is a moderator/system, not the user. */
  byOther?: 'moderator' | 'system';
}

const ACTIONS: ActionDef[] = [
  /* — auth / session — */
  { category: 'auth',     action: 'login_success',        description: () => 'Login bem-sucedido',                weight: 25 },
  { category: 'auth',     action: 'login_failed',         description: () => 'Tentativa de login rejeitada',      weight: 4, failureRate: 1 },
  { category: 'auth',     action: 'magic_link_requested', description: () => 'Solicitou link mágico por email',   weight: 12 },
  { category: 'auth',     action: 'logout',               description: () => 'Encerrou a sessão',                  weight: 18 },
  { category: 'session',  action: 'session_started',      description: () => 'Sessão iniciada',                    weight: 30 },
  { category: 'session',  action: 'session_ended',        description: () => 'Sessão encerrada',                   weight: 28 },

  /* — content — */
  { category: 'content',  action: 'post_created',         description: () => 'Criou uma publicação',               weight: 5,
    buildEntity: (rnd) => ({ type: 'post', id: idLike(rnd), label: 'Post no feed' }) },
  { category: 'content',  action: 'comment_created',      description: () => 'Comentou em uma publicação',         weight: 14,
    buildEntity: (rnd) => ({ type: 'comment', id: idLike(rnd), label: 'Comentário' }) },
  { category: 'content',  action: 'comment_deleted',      description: () => 'Apagou um comentário próprio',       weight: 2,
    buildEntity: (rnd) => ({ type: 'comment', id: idLike(rnd) }) },
  { category: 'content',  action: 'message_sent',         description: () => 'Enviou mensagem no chat',            weight: 35,
    buildEntity: (rnd) => ({ type: 'conversation', id: idLike(rnd), label: 'Conversa DM' }) },
  { category: 'content',  action: 'message_reacted',      description: () => 'Reagiu a uma mensagem',              weight: 18 },

  /* — streaming — */
  { category: 'streaming', action: 'track_played',        description: (rnd) => `Iniciou reprodução: ${pickTrack(rnd)}`, weight: 60,
    buildEntity: (rnd) => ({ type: 'track', id: idLike(rnd) }) },
  { category: 'streaming', action: 'track_completed',     description: (rnd) => `Concluiu reprodução: ${pickTrack(rnd)}`, weight: 38,
    buildEntity: (rnd) => ({ type: 'track', id: idLike(rnd) }) },
  { category: 'streaming', action: 'track_liked',         description: (rnd) => `Curtiu a música: ${pickTrack(rnd)}`,     weight: 12 },
  { category: 'streaming', action: 'track_skipped',       description: () => 'Pulou faixa antes do fim',          weight: 22 },

  /* — profile / settings — */
  { category: 'profile',   action: 'profile_updated',     description: () => 'Atualizou dados do perfil',          weight: 2,
    buildMetadata: (rnd) => ({
      campo: pickFrom(rnd, ['nome', 'cidade', 'bio', 'telefone']),
      antes: pickFrom(rnd, ['São Paulo - SP', 'Rio - RJ', 'Belo Horizonte - MG']),
      depois: pickFrom(rnd, ['Curitiba - PR', 'Porto Alegre - RS', 'Salvador - BA']),
    }) },
  { category: 'profile',   action: 'avatar_changed',      description: () => 'Trocou a foto de perfil',            weight: 1 },
  { category: 'settings',  action: 'privacy_changed',     description: () => 'Alterou configurações de privacidade', weight: 1,
    buildMetadata: (rnd) => ({
      mostrar_cidade: pickFrom(rnd, ['ligado', 'desligado']),
      permitir_mensagens: pickFrom(rnd, ['todos', 'apenas seguidores', 'ninguém']),
    }) },
  { category: 'settings',  action: 'notification_prefs',  description: () => 'Atualizou preferências de notificação', weight: 1 },

  /* — moderation — */
  { category: 'moderation', action: 'reported_by_user',   description: () => 'Foi denunciado por outro usuário',   weight: 1,
    byOther: 'moderator',
    buildMetadata: (rnd) => ({ motivo: pickFrom(rnd, ['spam', 'assédio', 'discurso de ódio', 'desinformação']) }) },
  { category: 'moderation', action: 'reported_someone',   description: () => 'Denunciou outro usuário',            weight: 1,
    buildEntity: (rnd) => ({ type: 'report', id: idLike(rnd) }) },
  { category: 'moderation', action: 'warning_issued',     description: () => 'Recebeu advertência da moderação',   weight: 0.5, byOther: 'moderator',
    buildMetadata: () => ({ severidade: 'leve' }) },

  /* — compliance / data subject — */
  { category: 'compliance', action: 'terms_accepted',     description: () => 'Aceitou os Termos de Uso',           weight: 0.5 },
  { category: 'compliance', action: 'privacy_accepted',   description: () => 'Aceitou a Política de Privacidade',  weight: 0.5 },
  { category: 'compliance', action: 'data_export_request',description: () => 'Solicitou exportação dos dados (LGPD Art. 18)', weight: 0.2 },
];

/* ── Helpers (LCG-seeded) ──────────────────────────────────── */

/** Fast deterministic 32-bit LCG. Hash the user id into a seed
 *  so each user gets a stable but distinct stream. */
function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}
function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

function pickFrom<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
function idLike(rnd: () => number): string {
  // Short stable id (12 hex chars) — good enough for the "Post #abc123" label.
  let out = '';
  for (let i = 0; i < 12; i++) out += Math.floor(rnd() * 16).toString(16);
  return out;
}
function pickTrack(rnd: () => number): string {
  return pickFrom(rnd, [
    'Boiadeira — Ana Castela',
    'Fronteira — Edson & Hudson',
    'Tô na Rua — Gusttavo Lima',
    'Coração Cigano — Henrique & Juliano',
    'Pipoco — Ana Castela ft. Melody',
    'Solteiro Forçado — Marília Mendonça',
    'Saudade da Minha Vida — João Gomes',
    'Nosso Quadro — Ana Castela',
    'Modão Raiz — Trio Parada Dura',
    'Anjo da Guarda — Luan Santana',
  ]);
}

function pickIp(rnd: () => number): string {
  // Brazilian-feel IPv4 ranges. Not exhaustive, just plausible.
  const prefixes = [
    [200, () => 1 + Math.floor(rnd() * 254)],
    [191, () => 1 + Math.floor(rnd() * 254)],
    [177, () => 1 + Math.floor(rnd() * 254)],
    [186, () => 1 + Math.floor(rnd() * 254)],
  ] as const;
  const [a] = prefixes[Math.floor(rnd() * prefixes.length)];
  return `${a}.${Math.floor(rnd() * 254)}.${Math.floor(rnd() * 254)}.${Math.floor(rnd() * 254)}`;
}

/* ── Public API ────────────────────────────────────────────── */

interface GenerateArgs {
  user: Pick<User, 'id' | 'city' | 'state'>;
  /** Approximate number of events to produce. Capped at 500 so
   *  the table stays performant. */
  count?: number;
  /** Number of days back to spread the events. */
  daysBack?: number;
}

export function generateUserActivities({
  user,
  count = 180,
  daysBack = 90,
}: GenerateArgs): UserActivityEvent[] {
  const rnd = makeRng(seedFromId(user.id));
  const safeCount = Math.min(Math.max(count, 10), 500);

  // Weighted pick — flatten ACTIONS by weight, then sample.
  const pool: ActionDef[] = [];
  for (const a of ACTIONS) {
    const reps = Math.max(1, Math.round(a.weight));
    for (let i = 0; i < reps; i++) pool.push(a);
  }

  const homeCity = user.city && user.state ? `${user.city} - ${user.state}` : pickFrom(rnd, CITIES_BR);

  // Generate raw events.
  const events: UserActivityEvent[] = [];
  const now = Date.now();
  const windowMs = daysBack * 24 * 60 * 60 * 1000;

  for (let i = 0; i < safeCount; i++) {
    // Bias toward recent — square the random number so newer wins.
    const t = rnd();
    const offsetMs = Math.floor((t * t) * windowMs);
    const ts = new Date(now - offsetMs).toISOString();

    const def = pool[Math.floor(rnd() * pool.length)];

    // Most events happen from the user's home city; 18% from a
    // travel city so the table tells some story.
    const city = rnd() < 0.82 ? homeCity : pickFrom(rnd, CITIES_BR);

    const failureRate = def.failureRate ?? 0;
    const result: UserActivityResult = rnd() < failureRate ? 'failure' : 'success';

    events.push({
      id: `act-${user.id.slice(0, 6)}-${i.toString(36).padStart(4, '0')}`,
      userId: user.id,
      category: def.category,
      action: def.action,
      description: def.description(rnd),
      timestamp: ts,
      result,
      ip: pickIp(rnd),
      userAgent: pickFrom(rnd, USER_AGENTS),
      channel: pickFrom(rnd, CHANNELS),
      city,
      country: 'Brasil',
      relatedEntity: def.buildEntity?.(rnd),
      metadata: def.buildMetadata?.(rnd),
      actor: def.byOther
        ? {
            id: def.byOther === 'system' ? 'system' : `mod-${Math.floor(rnd() * 8) + 1}`,
            name: def.byOther === 'system' ? 'Sistema (automático)' : pickFrom(rnd, [
              'Marina Costa',
              'João Pereira',
              'Equipe de Moderação',
              'Lucas Almeida',
            ]),
            role: def.byOther,
          }
        : { id: user.id, name: 'Próprio usuário', role: 'self' },
    });
  }

  // Newest-first.
  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/* ── Summary KPIs derived from the event list ──────────────── */

export interface UserActivitySummary {
  total: number;
  lastLogin: string | null;
  lastActivity: string | null;
  loginsLast30d: number;
  moderationIncidents: number;
  failedLogins: number;
  uniqueIps: number;
  uniqueDevices: number;
}

export function summarizeActivities(
  events: UserActivityEvent[],
): UserActivitySummary {
  const ips = new Set<string>();
  const devices = new Set<string>();
  let lastLogin: string | null = null;
  let loginsLast30d = 0;
  let moderationIncidents = 0;
  let failedLogins = 0;

  const cutoff30d = Date.now() - 30 * 24 * 60 * 60 * 1000;

  for (const e of events) {
    if (e.ip) ips.add(e.ip);
    if (e.userAgent) devices.add(e.userAgent);
    if (e.action === 'login_success') {
      if (!lastLogin || e.timestamp > lastLogin) lastLogin = e.timestamp;
      if (Date.parse(e.timestamp) >= cutoff30d) loginsLast30d++;
    }
    if (e.action === 'login_failed') failedLogins++;
    if (e.category === 'moderation') moderationIncidents++;
  }

  return {
    total: events.length,
    lastLogin,
    lastActivity: events[0]?.timestamp ?? null,
    loginsLast30d,
    moderationIncidents,
    failedLogins,
    uniqueIps: ips.size,
    uniqueDevices: devices.size,
  };
}
