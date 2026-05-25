import { api } from './api';

export type NotificationChannel = 'in_app' | 'email';
export type NotificationCategory =
  | 'lifecycle'
  | 'social'
  | 'content'
  | 'engagement';

export interface NotificationItem {
  kind: string;
  /** Effective label (override OU catálogo). */
  label: string;
  /** Effective description (override OU catálogo). */
  description: string;
  /** Effective trigger (override OU catálogo). */
  trigger: string;
  /** Catalog defaults — usados pra mostrar o valor "de fábrica" no UI
   * e habilitar o botão "restaurar padrão" quando o admin tiver
   * editado. Read-only no front. */
  defaultLabel: string;
  defaultDescription: string;
  defaultTrigger: string;
  /** Flags vindas do server indicando que o admin já editou aquele
   * campo (i.e. existe uma string salva na coluna override). Quando
   * true, o UI mostra o pill "editado" + permite restaurar. */
  hasLabelOverride: boolean;
  hasDescriptionOverride: boolean;
  hasTriggerOverride: boolean;
  category: NotificationCategory;
  supportedChannels: NotificationChannel[];
  defaultChannels: NotificationChannel[];
  wired: boolean;
  system: boolean;
  enabled: boolean;
  channels: Partial<Record<NotificationChannel, boolean>>;
  updatedAt: string | null;
}

export interface UpsertNotificationInput {
  kind: string;
  enabled: boolean;
  channels: Partial<Record<NotificationChannel, boolean>>;
  /** Semântica server-side:
   *   undefined → NÃO toca a coluna (mantém valor atual no DB)
   *   null      → limpa o override (volta pro catálogo)
   *   string    → grava como override
   */
  labelOverride?: string | null;
  descriptionOverride?: string | null;
  triggerOverride?: string | null;
}

/* Resposta do POST /api/admin/cron/trigger — `result` é "qualquer
 * coisa" porque cada handler de cron retorna stats diferentes
 * (managerDailyReport tem totalUsers/newUsers etc., dailyDigest
 * tem totalSent/skipped, communityInteractions tem sent/skipped).
 * Tipamos como Record genérico pra cobrir todos e deixar o UI
 * extrair só o que precisa exibir. */
export interface CronTriggerResponse {
  ok: boolean;
  kind: string;
  durationMs: number;
  result: Record<string, unknown>;
}

export const notificationsService = {
  list: () =>
    api.get<{ items: NotificationItem[] }>('/api/admin/notifications'),
  upsert: (input: UpsertNotificationInput) =>
    api.post<{ ok: boolean }>('/api/admin/notifications', input),
  /** Dispara um cron job manualmente — usado pelo botão "Enviar
   *  teste agora" do editor. Backend valida que o `kind` está no
   *  registry; se não estiver, devolve 400 invalid/unknown_kind. */
  trigger: (kind: string) =>
    api.post<CronTriggerResponse>('/api/admin/cron/trigger', { kind }),
};

/** Kinds de notificação que têm um cron job conectado e podem ser
 *  disparados pelo botão "Enviar teste agora". Mantemos a lista
 *  aqui (em vez de derivar do server) porque o editor precisa
 *  decidir SE mostra o botão antes mesmo de chamar a API. Espelha
 *  exatamente CRON_REGISTRY no servidor. */
export const TRIGGERABLE_KINDS = new Set<string>([
  'manager_daily_report',
  'daily_digest',
  'community_interactions',
]);

export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  lifecycle: 'Ciclo de vida',
  social: 'Social',
  content: 'Conteúdo da artista',
  engagement: 'Engajamento',
};

export const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  in_app: 'No app',
  email: 'Email',
};

/* ── Custom drafts (mock, client-only) ──────────────────────────
 *
 * O catálogo "real" (KNOWN_NOTIFICATIONS) vive no servidor e exige
 * deploy pra mudar. Pra que o admin possa simular "criar uma
 * notificação" sem depender do BE, mantemos um store local em
 * localStorage com notificações personalizadas. Aparece na listagem
 * com badge "Personalizada"; o editor detecta e salva também em
 * localStorage (não no DB).
 *
 * Quando o BE eventualmente suportar criação dinâmica, este store
 * pode virar um shim que faz POST + remove do localStorage. */

const CUSTOM_DRAFTS_KEY = 'notificacoes:custom-drafts';

export function loadCustomDrafts(): NotificationItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as NotificationItem[];
  } catch {
    return [];
  }
}

export function saveCustomDraft(draft: NotificationItem): void {
  if (typeof window === 'undefined') return;
  const all = loadCustomDrafts().filter((d) => d.kind !== draft.kind);
  all.push({ ...draft, updatedAt: new Date().toISOString() });
  window.localStorage.setItem(CUSTOM_DRAFTS_KEY, JSON.stringify(all));
}

export function deleteCustomDraft(kind: string): void {
  if (typeof window === 'undefined') return;
  const all = loadCustomDrafts().filter((d) => d.kind !== kind);
  window.localStorage.setItem(CUSTOM_DRAFTS_KEY, JSON.stringify(all));
}

export function isCustomDraftKind(kind: string): boolean {
  return loadCustomDrafts().some((d) => d.kind === kind);
}

/** Constrói um NotificationItem novo a partir dos campos mínimos
 *  do formulário de criação. Os campos `defaultX` espelham os
 *  efetivos (pra custom drafts não existe noção de "default" do
 *  catálogo), `hasXOverride` ficam false, `wired/system` false. */
export interface CreateCustomDraftInput {
  kind: string;
  label: string;
  description: string;
  trigger: string;
  category: NotificationCategory;
  supportedChannels: NotificationChannel[];
  defaultChannels: NotificationChannel[];
}

export function buildCustomDraft(
  input: CreateCustomDraftInput,
): NotificationItem {
  const channels: Partial<Record<NotificationChannel, boolean>> = {};
  for (const ch of input.supportedChannels) {
    channels[ch] = input.defaultChannels.includes(ch);
  }
  return {
    kind: input.kind,
    label: input.label,
    description: input.description,
    trigger: input.trigger,
    defaultLabel: input.label,
    defaultDescription: input.description,
    defaultTrigger: input.trigger,
    hasLabelOverride: false,
    hasDescriptionOverride: false,
    hasTriggerOverride: false,
    category: input.category,
    supportedChannels: input.supportedChannels,
    defaultChannels: input.defaultChannels,
    wired: false,
    system: false,
    enabled: true,
    channels,
    updatedAt: new Date().toISOString(),
  };
}
