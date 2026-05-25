import { api } from './api';

export type NotificationChannel = 'in_app' | 'email';
export type NotificationCategory =
  | 'lifecycle'
  | 'social'
  | 'content'
  | 'engagement';

export interface NotificationItem {
  kind: string;
  label: string;
  description: string;
  trigger: string;
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
