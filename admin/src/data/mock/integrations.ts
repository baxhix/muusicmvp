import type { Integration } from '@/types';

const NOW = Date.now();
const days = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

export const MOCK_INTEGRATIONS: Integration[] = [
  {
    id: 'int_spotify',
    name: 'Spotify',
    description: 'Sincroniza histórico de escuta e playlists dos usuários autorizados.',
    category: 'music',
    connected: true,
    connectedAt: days(180),
    scope: ['user-read-recently-played', 'user-top-read'],
  },
  {
    id: 'int_stripe',
    name: 'Stripe',
    description: 'Processa pagamentos de assinaturas, repasses e Faturamento.',
    category: 'payments',
    connected: true,
    connectedAt: days(412),
    scope: ['charges', 'subscriptions', 'connect'],
  },
  {
    id: 'int_mapbox',
    name: 'Mapbox',
    description: 'Renderiza o globo 3D e o mapa de superfãs em tempo real.',
    category: 'maps',
    connected: true,
    connectedAt: days(310),
  },
  {
    id: 'int_amplitude',
    name: 'Amplitude',
    description: 'Captura eventos de produto e funis de comportamento.',
    category: 'analytics',
    connected: false,
  },
  {
    id: 'int_slack',
    name: 'Slack',
    description: 'Recebe alertas de moderação e métricas operacionais em canais dedicados.',
    category: 'comms',
    connected: false,
  },
  {
    id: 'int_sentry',
    name: 'Sentry',
    description: 'Monitora erros e performance do app em produção.',
    category: 'analytics',
    connected: true,
    connectedAt: days(94),
  },
];
