import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { algorithmRules, users, type AlgorithmRule } from '@/server/db/schema';

/* ── Closed catalog ────────────────────────────────────────────
 *
 * The trigger + action vocabularies are intentionally hard-coded.
 * The admin composer renders dropdowns from these arrays, the
 * SQL CHECK constraint refuses anything else, and the (future)
 * player engine matches against this exact list. Adding a new
 * trigger or action is a 3-line code PR (here + migration enum +
 * client renderer) — that friction is the point: we never have a
 * rule on the books that the engine can't run.
 */

export const TRIGGER_EVENTS = [
  'session_started',
  'idle_in_screen',
  'feed_scroll_streak',
  'track_completed',
  'track_skipped',
  'time_in_app_minutes',
  'consecutive_inactive_days',
] as const;

export const ACTION_KINDS = [
  'show_toast',
  'nudge_to_screen',
  'inject_recommendation',
  'show_modal',
] as const;

export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];
export type ActionKind   = (typeof ACTION_KINDS)[number];

/** Per-trigger config schema descriptor — drives the admin
 *  composer's field rendering AND gives the engine a typed
 *  contract. Each key in `fields` maps to one input. */
export const TRIGGER_META: Record<
  TriggerEvent,
  { label: string; helper: string; fields: Record<string, ConfigField> }
> = {
  session_started: {
    label: 'Início de sessão',
    helper: 'Dispara quando o usuário inicia uma sessão no app.',
    fields: {},
  },
  idle_in_screen: {
    label: 'Inatividade em tela',
    helper: 'Dispara quando o usuário fica parado em uma tela por X segundos.',
    fields: {
      screen: {
        kind: 'enum',
        label: 'Tela',
        helper: 'Qual tela é monitorada. "Qualquer" cobre todo /app.',
        options: ['any', 'feed', 'chat', 'profile', 'player'],
        defaultValue: 'any',
      },
      seconds: {
        kind: 'number',
        label: 'Segundos de inatividade',
        helper: 'Quantos segundos sem interação antes de disparar.',
        defaultValue: 30,
        min: 5,
        max: 600,
      },
    },
  },
  feed_scroll_streak: {
    label: 'Streak de scroll no feed',
    helper: 'Dispara quando o usuário passa X posts sem curtir/comentar.',
    fields: {
      count: {
        kind: 'number',
        label: 'Posts consecutivos',
        helper: 'Quantos posts passar sem engajar antes de disparar.',
        defaultValue: 10,
        min: 3,
        max: 50,
      },
    },
  },
  track_completed: {
    label: 'Faixa concluída',
    helper: 'Dispara quando o usuário escuta uma faixa até o fim.',
    fields: {},
  },
  track_skipped: {
    label: 'Faixa pulada',
    helper: 'Dispara quando o usuário pula uma faixa antes de terminar.',
    fields: {},
  },
  time_in_app_minutes: {
    label: 'Tempo no app',
    helper: 'Dispara após Y minutos contínuos no app.',
    fields: {
      minutes: {
        kind: 'number',
        label: 'Minutos',
        helper: 'Tempo em minutos antes de disparar.',
        defaultValue: 15,
        min: 1,
        max: 240,
      },
    },
  },
  consecutive_inactive_days: {
    label: 'Dias inativos',
    helper: 'Dispara quando o usuário volta após N dias sem entrar.',
    fields: {
      days: {
        kind: 'number',
        label: 'Dias sem entrar',
        helper: 'Mínimo de dias inativos antes do retorno disparar.',
        defaultValue: 3,
        min: 1,
        max: 60,
      },
    },
  },
};

export const ACTION_META: Record<
  ActionKind,
  { label: string; helper: string; fields: Record<string, ConfigField> }
> = {
  show_toast: {
    label: 'Mostrar toast',
    helper: 'Mensagem flutuante curta. Boa para nudges leves.',
    fields: {
      title: {
        kind: 'string',
        label: 'Título',
        helper: 'Curto (até 60 chars).',
        defaultValue: '',
        maxLength: 60,
      },
      body: {
        kind: 'string',
        label: 'Mensagem',
        helper: 'Texto principal exibido.',
        defaultValue: '',
        maxLength: 240,
      },
      cta_label: {
        kind: 'string',
        label: 'Texto do botão (opcional)',
        helper: 'Deixe vazio para toast sem ação.',
        defaultValue: '',
        maxLength: 30,
      },
      cta_url: {
        kind: 'string',
        label: 'URL/rota do botão (opcional)',
        helper: 'Aceita rotas internas (/app/feed) ou URLs externas.',
        defaultValue: '',
        maxLength: 200,
      },
    },
  },
  nudge_to_screen: {
    label: 'Sugerir tela',
    helper: 'Empurra o usuário para uma tela específica via micro-prompt.',
    fields: {
      screen: {
        kind: 'enum',
        label: 'Tela alvo',
        helper: 'Para onde direcionar.',
        options: ['feed', 'chat', 'profile', 'player'],
        defaultValue: 'feed',
      },
      message: {
        kind: 'string',
        label: 'Mensagem',
        helper: 'Frase curta exibida no nudge.',
        defaultValue: 'Tem novidade aqui',
        maxLength: 80,
      },
    },
  },
  inject_recommendation: {
    label: 'Injetar recomendação',
    helper: 'Adiciona um item recomendado ao feed/player do usuário.',
    fields: {
      kind: {
        kind: 'enum',
        label: 'Tipo de recomendação',
        helper: 'Qual lógica de recomendação aplicar.',
        options: ['similar_track', 'popular_post', 'superfan', 'new_creator'],
        defaultValue: 'similar_track',
      },
    },
  },
  show_modal: {
    label: 'Mostrar modal',
    helper: 'Diálogo bloqueante com até 2 CTAs. Use com parcimônia.',
    fields: {
      title: {
        kind: 'string',
        label: 'Título',
        helper: '',
        defaultValue: '',
        maxLength: 80,
      },
      body: {
        kind: 'string',
        label: 'Corpo',
        helper: '',
        defaultValue: '',
        maxLength: 500,
      },
      primary_cta: {
        kind: 'string',
        label: 'CTA primário',
        helper: 'Texto do botão principal.',
        defaultValue: 'OK',
        maxLength: 30,
      },
      primary_url: {
        kind: 'string',
        label: 'URL do CTA primário (opcional)',
        helper: '',
        defaultValue: '',
        maxLength: 200,
      },
      secondary_cta: {
        kind: 'string',
        label: 'CTA secundário (opcional)',
        helper: 'Deixe vazio para apenas um botão.',
        defaultValue: '',
        maxLength: 30,
      },
    },
  },
};

/** Field descriptor consumed by the admin composer. The kinds here
 *  map 1:1 to renderer cases in the form component. */
export type ConfigField =
  | { kind: 'string'; label: string; helper: string; defaultValue: string;  maxLength?: number }
  | { kind: 'number'; label: string; helper: string; defaultValue: number;  min?: number; max?: number }
  | { kind: 'boolean'; label: string; helper: string; defaultValue: boolean }
  | { kind: 'enum';   label: string; helper: string; options: string[];     defaultValue: string };

/* ── Hydrated output shape returned by the API ─────────────────── */

export interface HydratedAlgorithmRule {
  id: string;
  name: string;
  description: string;
  triggerEvent: TriggerEvent;
  triggerConfig: Record<string, unknown>;
  actionKind: ActionKind;
  actionConfig: Record<string, unknown>;
  serviceName: string | null;
  targetObject: string | null;
  tags: string[];
  documentationUrl: string | null;
  enabled: boolean;
  priority: number;
  cooldownSeconds: number;
  maxPerSession: number;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
}

/* ── Input shape ─────────────────────────────────────────────── */

export interface AlgorithmRuleInput {
  name?: string;
  description?: string;
  triggerEvent?: TriggerEvent;
  triggerConfig?: Record<string, unknown>;
  actionKind?: ActionKind;
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

/* ── DB plumbing ─────────────────────────────────────────────── */

function selectWithAuthor() {
  return db
    .select({
      id: algorithmRules.id,
      name: algorithmRules.name,
      description: algorithmRules.description,
      triggerEvent: algorithmRules.triggerEvent,
      triggerConfig: algorithmRules.triggerConfig,
      actionKind: algorithmRules.actionKind,
      actionConfig: algorithmRules.actionConfig,
      serviceName: algorithmRules.serviceName,
      targetObject: algorithmRules.targetObject,
      tags: algorithmRules.tags,
      documentationUrl: algorithmRules.documentationUrl,
      enabled: algorithmRules.enabled,
      priority: algorithmRules.priority,
      cooldownSeconds: algorithmRules.cooldownSeconds,
      maxPerSession: algorithmRules.maxPerSession,
      createdByUserId: algorithmRules.createdByUserId,
      createdAt: algorithmRules.createdAt,
      updatedAt: algorithmRules.updatedAt,
      authorName: users.name,
      authorEmail: users.email,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(algorithmRules)
    .leftJoin(users, eq(users.id, algorithmRules.createdByUserId));
}

type SelectedRow = AlgorithmRule & {
  authorName: string | null;
  authorEmail: string | null;
  authorAvatarUrl: string | null;
};

function hydrate(row: SelectedRow): HydratedAlgorithmRule {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    triggerEvent: row.triggerEvent as TriggerEvent,
    triggerConfig: (row.triggerConfig ?? {}) as Record<string, unknown>,
    actionKind: row.actionKind as ActionKind,
    actionConfig: (row.actionConfig ?? {}) as Record<string, unknown>,
    serviceName: row.serviceName,
    targetObject: row.targetObject,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    documentationUrl: row.documentationUrl,
    enabled: row.enabled,
    priority: row.priority,
    cooldownSeconds: row.cooldownSeconds,
    maxPerSession: row.maxPerSession,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdByUserId
      ? {
          id: row.createdByUserId,
          name: row.authorName,
          email: row.authorEmail ?? '',
          avatarUrl: row.authorAvatarUrl,
        }
      : null,
  };
}

/* ── CRUD ────────────────────────────────────────────────────── */

/** Argument shape for `listAlgorithmRules`. Exported so callers
 *  (API routes, tests) can type-check their own filter objects
 *  without reaching for `Parameters<typeof …>` ergonomics. */
export interface ListAlgorithmRulesArgs {
  search?: string;
  triggerEvent?: TriggerEvent | 'all';
  actionKind?: ActionKind | 'all';
  enabled?: boolean | 'all';
  limit?: number;
  offset?: number;
}

export async function listAlgorithmRules(
  args: ListAlgorithmRulesArgs = {},
): Promise<{ items: HydratedAlgorithmRule[]; total: number }> {
  const safeLimit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  const safeOffset = Math.max(args.offset ?? 0, 0);

  const whereExpr = and(
    args.triggerEvent && args.triggerEvent !== 'all'
      ? eq(algorithmRules.triggerEvent, args.triggerEvent)
      : undefined,
    args.actionKind && args.actionKind !== 'all'
      ? eq(algorithmRules.actionKind, args.actionKind)
      : undefined,
    args.enabled !== undefined && args.enabled !== 'all'
      ? eq(algorithmRules.enabled, args.enabled)
      : undefined,
    args.search
      ? or(
          ilike(algorithmRules.name, `%${args.search}%`),
          ilike(algorithmRules.description, `%${args.search}%`),
          ilike(algorithmRules.serviceName, `%${args.search}%`),
        )
      : undefined,
  );

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(algorithmRules)
    .where(whereExpr);

  const rows = await selectWithAuthor()
    .where(whereExpr)
    .orderBy(desc(algorithmRules.updatedAt))
    .limit(safeLimit)
    .offset(safeOffset);

  return {
    items: rows.map(hydrate),
    total: Number(count ?? 0),
  };
}

export async function getAlgorithmRule(
  id: string,
): Promise<HydratedAlgorithmRule | null> {
  const rows = await selectWithAuthor().where(eq(algorithmRules.id, id)).limit(1);
  return rows[0] ? hydrate(rows[0]) : null;
}

/** Server-side validation that picks up where the SQL CHECK
 *  constraints leave off — surface readable error codes the API
 *  routes can map to 400 responses. */
function validateInput(input: AlgorithmRuleInput, isCreate: boolean): void {
  if (isCreate) {
    if (!input.name?.trim()) throw new Error('name_required');
    if (!input.description?.trim()) throw new Error('description_required');
    if (!input.triggerEvent) throw new Error('trigger_required');
    if (!input.actionKind) throw new Error('action_required');
  }
  if (input.name !== undefined && input.name.length > 200) {
    throw new Error('name_too_long');
  }
  if (input.description !== undefined && input.description.length > 2000) {
    throw new Error('description_too_long');
  }
  if (input.triggerEvent && !TRIGGER_EVENTS.includes(input.triggerEvent)) {
    throw new Error('invalid_trigger');
  }
  if (input.actionKind && !ACTION_KINDS.includes(input.actionKind)) {
    throw new Error('invalid_action');
  }
  if (input.priority !== undefined && input.priority < 0) {
    throw new Error('invalid_priority');
  }
  if (input.cooldownSeconds !== undefined && input.cooldownSeconds < 0) {
    throw new Error('invalid_cooldown');
  }
  if (input.maxPerSession !== undefined && input.maxPerSession < 0) {
    throw new Error('invalid_max_per_session');
  }
}

export async function createAlgorithmRule(
  adminId: string,
  input: AlgorithmRuleInput,
): Promise<HydratedAlgorithmRule> {
  validateInput(input, true);

  const [row] = await db
    .insert(algorithmRules)
    .values({
      name: input.name!.trim(),
      description: input.description!.trim(),
      triggerEvent: input.triggerEvent!,
      triggerConfig: input.triggerConfig ?? {},
      actionKind: input.actionKind!,
      actionConfig: input.actionConfig ?? {},
      serviceName: input.serviceName ?? null,
      targetObject: input.targetObject ?? null,
      tags: input.tags ?? [],
      documentationUrl: input.documentationUrl ?? null,
      enabled: input.enabled ?? false,
      priority: input.priority ?? 100,
      cooldownSeconds: input.cooldownSeconds ?? 0,
      maxPerSession: input.maxPerSession ?? 0,
      createdByUserId: adminId,
    })
    .returning({ id: algorithmRules.id });

  const hydrated = await getAlgorithmRule(row.id);
  if (!hydrated) throw new Error('post_insert_fetch_failed');
  return hydrated;
}

export async function updateAlgorithmRule(
  id: string,
  input: AlgorithmRuleInput,
): Promise<HydratedAlgorithmRule> {
  validateInput(input, false);

  const patch: Partial<typeof algorithmRules.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.triggerEvent !== undefined) patch.triggerEvent = input.triggerEvent;
  if (input.triggerConfig !== undefined) patch.triggerConfig = input.triggerConfig;
  if (input.actionKind !== undefined) patch.actionKind = input.actionKind;
  if (input.actionConfig !== undefined) patch.actionConfig = input.actionConfig;
  if (input.serviceName !== undefined) patch.serviceName = input.serviceName;
  if (input.targetObject !== undefined) patch.targetObject = input.targetObject;
  if (input.tags !== undefined) patch.tags = input.tags;
  if (input.documentationUrl !== undefined) patch.documentationUrl = input.documentationUrl;
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.cooldownSeconds !== undefined) patch.cooldownSeconds = input.cooldownSeconds;
  if (input.maxPerSession !== undefined) patch.maxPerSession = input.maxPerSession;

  const result = await db
    .update(algorithmRules)
    .set(patch)
    .where(eq(algorithmRules.id, id))
    .returning({ id: algorithmRules.id });

  if (result.length === 0) throw new Error('rule_not_found');

  const hydrated = await getAlgorithmRule(id);
  if (!hydrated) throw new Error('post_update_fetch_failed');
  return hydrated;
}

export async function deleteAlgorithmRule(id: string): Promise<boolean> {
  const result = await db
    .delete(algorithmRules)
    .where(eq(algorithmRules.id, id))
    .returning({ id: algorithmRules.id });
  return result.length > 0;
}
