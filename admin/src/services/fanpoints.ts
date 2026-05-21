import { api } from './api';

/**
 * Fanpoint rules — quanto cada ActivityKind credita ao usuário.
 *
 * Todas as 7 kinds vêm do backend; somente `points` é editável
 * (por isso o `save` recebe só o valor numérico). O backend faz
 * UPSERT e invalida o cache local da instância — outras
 * instâncias da web pegam o valor novo em até 60s (TTL do cache).
 *
 * Quando o enum `ActivityKind` for estendido no servidor, o
 * endpoint já passa a listar a nova kind sem precisar mexer aqui.
 */

export type FanpointRuleKind =
  | 'stream'
  | 'login'
  | 'chat_started'
  | 'post_liked'
  | 'comment_posted'
  | 'post_shared'
  | 'three_streams';

export interface FanpointRule {
  kind: FanpointRuleKind;
  points: number;
  updatedAt: string;
  updatedBy: { id: string; name: string | null; email: string } | null;
}

export const fanpointsService = {
  list: () =>
    api.get<{ items: FanpointRule[] }>('/api/admin/fanpoints/rules'),

  save: (kind: FanpointRuleKind, points: number) =>
    api.patch<{ ok: true }>(`/api/admin/fanpoints/rules/${kind}`, { points }),
};
