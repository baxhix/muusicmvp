import { api } from './api';

export interface EngagementSnapshot {
  totalMessages: number;
  totalReactions: number;
  chatsStarted: number;
  superchatParticipants: number;
  messagesPerDay: Array<{ day: string; count: number }>;
}

export const engagementService = {
  get: () => api.get<EngagementSnapshot>('/api/admin/engagement?days=30'),
};
