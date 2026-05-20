/**
 * Fanpoints — regras de pontuação por comportamento do usuário.
 *
 * Modelo: cada comportamento do app que vale pontos vira uma linha
 * aqui. O serviço que processa eventos dos usuários (player,
 * social, presença) consulta a tabela pra saber quanto creditar.
 *
 * Campos:
 *   - `key`       — identificador interno usado pelos emissores
 *                   de evento (ex.: 'play_complete', 'wave_send').
 *                   Mantenha snake_case + estável; usuários do
 *                   admin enxergam `label` em PT-BR.
 *   - `points`    — quantos Fanpoints o comportamento rende. Pode
 *                   ser negativo (skip antes de 30s = penalidade).
 *   - `dailyCap`  — máximo de pontos que esse comportamento pode
 *                   creditar por usuário num dia. `0` = sem cap.
 *   - `enabled`   — se a regra está ativa. Desligado, o evento
 *                   ainda é registrado pra histórico mas não
 *                   credita Fanpoints.
 *
 * Quando o backend de fanpoints subir, troca-se o array por
 * `fetch('/api/admin/fanpoints/rules')` — formato é idêntico.
 */

export type FanpointCategory =
  | 'playback'    // ações no player (play, skip, repeat)
  | 'social'      // interação com outros fãs (wave, comment, like)
  | 'engagement'  // engajamento amplo (login, streak, perfil)
  | 'events'      // ações em eventos reais (check-in em show)
  | 'first_time'; // ações que só rendem uma vez (perfil, primeiro convite)

export interface FanpointRule {
  id: string;
  key: string;
  label: string;
  description: string;
  points: number;
  dailyCap: number;
  category: FanpointCategory;
  enabled: boolean;
  updatedAt: string;
}

export const CATEGORY_LABEL: Record<FanpointCategory, string> = {
  playback:   'Player',
  social:     'Social',
  engagement: 'Engajamento',
  events:     'Eventos',
  first_time: 'Primeira vez',
};

export const MOCK_FANPOINT_RULES: FanpointRule[] = [
  {
    id: 'fp-play-complete',
    key: 'play_complete',
    label: 'Play completo de uma faixa',
    description: 'Faixa ouvida até o fim (mínimo de 90% do tempo).',
    points: 5,
    dailyCap: 200,
    category: 'playback',
    enabled: true,
    updatedAt: '2026-04-12T10:30:00.000Z',
  },
  {
    id: 'fp-skip-early',
    key: 'skip_early',
    label: 'Skip antes de 30s',
    description: 'Penalidade leve quando o usuário pula a faixa rápido. Evita farmar play via reproduções curtas.',
    points: -2,
    dailyCap: 0,
    category: 'playback',
    enabled: true,
    updatedAt: '2026-04-12T10:31:00.000Z',
  },
  {
    id: 'fp-share-track',
    key: 'share_track',
    label: 'Compartilhar uma faixa',
    description: 'Share via Stories, link copiado ou compartilhamento nativo.',
    points: 10,
    dailyCap: 50,
    category: 'social',
    enabled: true,
    updatedAt: '2026-04-15T16:22:00.000Z',
  },
  {
    id: 'fp-wave-send',
    key: 'wave_send',
    label: 'Acenar para outro fã',
    description: 'Wave enviado direto do globo ou da listagem de superfãs.',
    points: 3,
    dailyCap: 30,
    category: 'social',
    enabled: true,
    updatedAt: '2026-04-18T09:14:00.000Z',
  },
  {
    id: 'fp-wave-receive',
    key: 'wave_receive',
    label: 'Receber um wave',
    description: 'Crédito de presença — ser notado por outro fã também conta.',
    points: 2,
    dailyCap: 30,
    category: 'social',
    enabled: true,
    updatedAt: '2026-04-18T09:14:00.000Z',
  },
  {
    id: 'fp-show-checkin',
    key: 'show_checkin',
    label: 'Check-in num show da Ana',
    description: 'Usuário faz check-in dentro do raio do venue durante o horário do show. Sem cap diário (mas só vale 1× por show).',
    points: 100,
    dailyCap: 0,
    category: 'events',
    enabled: true,
    updatedAt: '2026-03-25T20:01:00.000Z',
  },
  {
    id: 'fp-comment-post',
    key: 'comment_post',
    label: 'Publicar um comentário',
    description: 'Comentário em qualquer surface (feed, comunidade, chat).',
    points: 8,
    dailyCap: 40,
    category: 'social',
    enabled: true,
    updatedAt: '2026-04-02T11:48:00.000Z',
  },
  {
    id: 'fp-like-post',
    key: 'like_post',
    label: 'Curtir um post',
    description: 'Curtida em qualquer item do feed ou em comunidade.',
    points: 1,
    dailyCap: 100,
    category: 'social',
    enabled: true,
    updatedAt: '2026-04-02T11:48:00.000Z',
  },
  {
    id: 'fp-daily-login',
    key: 'daily_login',
    label: 'Primeiro acesso do dia',
    description: 'Bônus diário pelo retorno. Conta 1× por dia (cap embutido).',
    points: 5,
    dailyCap: 5,
    category: 'engagement',
    enabled: true,
    updatedAt: '2026-04-20T07:30:00.000Z',
  },
  {
    id: 'fp-streak-7d',
    key: 'streak_7d',
    label: 'Streak de 7 dias',
    description: 'Bônus semanal por fechar 7 logins consecutivos. Concedido na 7ª entrada.',
    points: 50,
    dailyCap: 0,
    category: 'engagement',
    enabled: true,
    updatedAt: '2026-04-20T07:30:00.000Z',
  },
  {
    id: 'fp-presave',
    key: 'presave_track',
    label: 'Pre-save de uma faixa',
    description: 'Usuário ativa o pre-save de uma campanha (cada campanha rende uma vez).',
    points: 25,
    dailyCap: 0,
    category: 'first_time',
    enabled: true,
    updatedAt: '2026-04-30T13:00:00.000Z',
  },
  {
    id: 'fp-invite-redeemed',
    key: 'invite_redeemed',
    label: 'Convite resgatado',
    description: 'Um convite emitido pelo usuário foi usado por outra pessoa. Cada redenção conta uma vez.',
    points: 200,
    dailyCap: 0,
    category: 'first_time',
    enabled: true,
    updatedAt: '2026-03-08T15:22:00.000Z',
  },
  {
    id: 'fp-profile-complete',
    key: 'profile_complete',
    label: 'Completar perfil',
    description: 'Avatar + bio + cidade preenchidos. Concedido uma única vez.',
    points: 50,
    dailyCap: 0,
    category: 'first_time',
    enabled: true,
    updatedAt: '2026-03-08T15:22:00.000Z',
  },
];

export function loadFanpointRules(): FanpointRule[] {
  return [...MOCK_FANPOINT_RULES];
}
