import type { TeamMember } from '@/types';

const NOW = Date.now();
const days = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const minutes = (n: number) => new Date(NOW - n * 60_000).toISOString();

/* groupAccess preenchido com exemplos plausíveis pra cada role.
 * Owner fica com undefined (acesso total — bypass do gating); os
 * demais recebem subconjuntos coerentes com o nível de privilégio.
 * A lista de chaves espelha as labels da Sidebar (componentes/layout/
 * Sidebar.tsx) — qualquer rename lá precisa rebatizar aqui. */
export const MOCK_TEAM: TeamMember[] = [
  {
    id: 'tm_001',
    name: 'Marcelo Baxhix',
    email: 'marcelo@fanverse.app',
    avatar: 'https://i.pravatar.cc/120?img=68',
    role: 'owner',
    invitedAt: days(720),
    lastActiveAt: minutes(2),
    twoFactor: true,
    status: 'active',
    // undefined = acesso total
  },
  {
    id: 'tm_002',
    name: 'Helena Drummond',
    email: 'helena@fanverse.app',
    avatar: 'https://i.pravatar.cc/120?img=42',
    role: 'admin',
    invitedAt: days(412),
    lastActiveAt: minutes(28),
    twoFactor: true,
    status: 'active',
    groupAccess: ['Dashboard', 'Usuários', 'Plataforma', 'Superfãs', 'Growth', 'Site', 'Sistema'],
  },
  {
    id: 'tm_003',
    name: 'Vinícius Marques',
    email: 'vinicius@fanverse.app',
    avatar: 'https://i.pravatar.cc/120?img=14',
    role: 'admin',
    invitedAt: days(310),
    lastActiveAt: minutes(180),
    twoFactor: false,
    status: 'active',
    groupAccess: ['Dashboard', 'Plataforma', 'Superfãs', 'Growth'],
  },
  {
    id: 'tm_004',
    name: 'Patrícia Rocha',
    email: 'patricia@fanverse.app',
    avatar: 'https://i.pravatar.cc/120?img=39',
    role: 'moderator',
    invitedAt: days(186),
    lastActiveAt: minutes(11),
    twoFactor: true,
    status: 'active',
    groupAccess: ['Usuários', 'Plataforma', 'Superfãs'],
  },
  {
    id: 'tm_005',
    name: 'Bruno Tavares',
    email: 'bruno@fanverse.app',
    avatar: 'https://i.pravatar.cc/120?img=21',
    role: 'moderator',
    invitedAt: days(94),
    lastActiveAt: days(2),
    twoFactor: false,
    status: 'active',
    groupAccess: ['Plataforma'],
  },
  {
    id: 'tm_006',
    name: 'Sofia Andrade',
    email: 'sofia@fanverse.app',
    avatar: 'https://i.pravatar.cc/120?img=36',
    role: 'readonly',
    invitedAt: days(60),
    lastActiveAt: days(5),
    twoFactor: false,
    status: 'active',
    groupAccess: ['Dashboard'],
  },
  {
    id: 'tm_007',
    name: 'Paulo Henrique',
    email: 'paulo.henrique@fanverse.app',
    role: 'admin',
    invitedAt: days(2),
    lastActiveAt: days(2),
    twoFactor: false,
    status: 'invited',
    groupAccess: ['Dashboard', 'Plataforma', 'Superfãs'],
  },
];
