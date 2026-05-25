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

export const notificationsService = {
  list: () =>
    api.get<{ items: NotificationItem[] }>('/api/admin/notifications'),
  upsert: (input: UpsertNotificationInput) =>
    api.post<{ ok: boolean }>('/api/admin/notifications', input),
};

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
