import type { ApiKey } from '@/types';

const NOW = Date.now();
const days = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const minutes = (n: number) => new Date(NOW - n * 60_000).toISOString();

export const MOCK_API_KEYS: ApiKey[] = [
  {
    id: 'ak_001',
    label: 'Backend produção',
    prefix: 'fv_live_8xQ2',
    createdAt: days(180),
    lastUsedAt: minutes(3),
    scopes: ['users:read', 'users:write', 'posts:read', 'reports:read'],
    createdBy: 'Marcelo Baxhix',
  },
  {
    id: 'ak_002',
    label: 'Backend staging',
    prefix: 'fv_test_4Bm9',
    createdAt: days(140),
    lastUsedAt: minutes(40),
    scopes: ['users:read', 'posts:read'],
    createdBy: 'Helena Drummond',
  },
  {
    id: 'ak_003',
    label: 'Worker de exportação',
    prefix: 'fv_live_2Ka7',
    createdAt: days(82),
    lastUsedAt: days(1),
    scopes: ['superfans:read', 'metrics:read'],
    createdBy: 'Vinícius Marques',
  },
  {
    id: 'ak_004',
    label: 'Integração Slack (legado)',
    prefix: 'fv_live_9pV1',
    createdAt: days(310),
    scopes: ['reports:read'],
    createdBy: 'Helena Drummond',
  },
];
