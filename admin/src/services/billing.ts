import { api } from './api';
import type { WorkspaceSettings } from '@/types';

export const workspaceService = {
  get:    () => api.get<WorkspaceSettings>('/settings/workspace'),
  update: (data: Partial<WorkspaceSettings>) =>
    api.patch<WorkspaceSettings>('/settings/workspace', data),
};
