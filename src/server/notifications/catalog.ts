/**
 * Catálogo declarativo de notificações que a plataforma dispara.
 *
 * Funciona igual ao KNOWN_TEMPLATES em emails: o `kind` é o slug
 * estável usado pelo código (`isNotificationEnabled('boas_vindas',
 * 'email')`); o resto é metadata pro admin entender + decidir
 * on/off.
 *
 * Quando o backend implementar um novo trigger:
 *   1. Adicionar entrada aqui com `wired: true`
 *   2. Chamar `await isNotificationEnabled(kind, channel)` antes
 *      de mandar pra Resend / inserir em `notifications`
 *
 * Itens com `wired: false` aparecem no admin como "Planejado" —
 * roadmap pra quem está alinhando o que vem a seguir.
 *
 * Itens com `system: true` não podem ser desativados via UI
 * (magic link, etc) porque desligar quebra fluxos críticos.
 */

export type NotificationChannel = 'in_app' | 'email';

export type NotificationCategory =
  | 'lifecycle' // onboarding, login, recuperação
  | 'social' // mensagens, menções, follows
  | 'content' // novos posts, lives, releases da artista
  | 'engagement'; // achievements, lembretes, fanpoints

export interface KnownNotification {
  kind: string;
  label: string;
  /** Descrição visível pra o admin entender o gatilho. */
  description: string;
  /** Regra de disparo em linguagem natural. */
  trigger: string;
  category: NotificationCategory;
  /** Canais que ESTE tipo suporta. UI mostra um toggle por canal,
   *  mas só os que estão aqui. */
  supportedChannels: NotificationChannel[];
  /** Canais ativos por DEFAULT (quando admin não setou ainda). */
  defaultChannels: NotificationChannel[];
  /** True = sistema dispara hoje. False = planejado (roadmap). */
  wired: boolean;
  /** True = não pode ser desativado via UI (sistema-crítico). */
  system?: boolean;
}

export const KNOWN_NOTIFICATIONS: KnownNotification[] = [
  /* ── Lifecycle ─────────────────────────────────────────── */
  {
    kind: 'magic_link',
    label: 'Link de acesso',
    description: 'Email de login que contém o link mágico + código OTP.',
    trigger: 'Usuário pede pra entrar via email em /auth ou /api/auth/request.',
    category: 'lifecycle',
    supportedChannels: ['email'],
    defaultChannels: ['email'],
    wired: true,
    system: true,
  },
  {
    kind: 'boas_vindas',
    label: 'Boas-vindas',
    description: 'Cumprimento ao usuário recém-cadastrado.',
    trigger: 'Disparada uma única vez quando o onboarding é completado (POST /api/auth/onboarding).',
    category: 'lifecycle',
    supportedChannels: ['email'],
    defaultChannels: ['email'],
    wired: true,
  },
  {
    kind: 'inactive_reminder',
    label: 'Lembrete de inatividade',
    description: 'Empurrão pra usuários que não voltam há semanas.',
    trigger: 'Cron diário identifica usuários com last_seen_at > N dias e dispara email com prévia do que rolou.',
    category: 'lifecycle',
    supportedChannels: ['email'],
    defaultChannels: ['email'],
    wired: false,
  },

  /* ── Social ────────────────────────────────────────────── */
  {
    kind: 'new_dm',
    label: 'Nova mensagem direta',
    description:
      'Quando outro fã inicia ou responde uma DM. Dispara nos dois ' +
      'canais (in-app e email) pra TODO destinatário, online ou não — ' +
      'email é canal redundante além do realtime. Pra evitar emails ' +
      'em DMs ativas, desligue o canal email aqui no admin.',
    trigger:
      'Mensagem inserida em `messages` com kind=dm. Email vai pra ' +
      'todo recipientId independente de presença.',
    category: 'social',
    supportedChannels: ['in_app', 'email'],
    defaultChannels: ['in_app', 'email'],
    wired: true,
  },
  {
    kind: 'new_follower',
    label: 'Novo seguidor',
    description: 'Alguém começou a seguir você.',
    trigger: 'Insert em `follows` com follower_id != following_id.',
    category: 'social',
    supportedChannels: ['in_app'],
    defaultChannels: ['in_app'],
    wired: false,
  },
  {
    kind: 'comment_reply',
    label: 'Resposta no seu comentário',
    description: 'Alguém respondeu seu comentário no feed.',
    trigger: 'Insert em `feed_comments` com parent_id apontando pra comentário seu.',
    category: 'social',
    supportedChannels: ['in_app'],
    defaultChannels: ['in_app'],
    wired: false,
  },
  {
    kind: 'post_reaction',
    label: 'Reação no seu post',
    description: 'Alguém reagiu (curtiu/coração) num post seu.',
    trigger: 'Insert em `feed_post_reactions`.',
    category: 'social',
    supportedChannels: ['in_app'],
    defaultChannels: ['in_app'],
    wired: false,
  },

  /* ── Conteúdo da artista ─────────────────────────────── */
  {
    kind: 'new_artist_post',
    label: 'Post novo da artista',
    description: 'A artista publicou algo no feed.',
    trigger: 'Insert em `feed_posts` por user com role=artist.',
    category: 'content',
    supportedChannels: ['in_app', 'email'],
    defaultChannels: ['in_app'],
    wired: false,
  },
  {
    kind: 'live_starting',
    label: 'Live começando',
    description: 'A artista entrou ao vivo. Avisar quem está online.',
    trigger: 'Live event com status=live dispara broadcast em massa.',
    category: 'content',
    supportedChannels: ['in_app'],
    defaultChannels: ['in_app'],
    wired: false,
  },
  {
    kind: 'new_track_release',
    label: 'Novo lançamento',
    description: 'Faixa nova adicionada ao catálogo da artista.',
    trigger: 'Insert em `tracks` com status=published.',
    category: 'content',
    supportedChannels: ['in_app', 'email'],
    defaultChannels: ['in_app', 'email'],
    wired: false,
  },
  {
    kind: 'community_new_topic',
    label: 'Novo tópico em comunidade que você segue',
    description: 'Alguém abriu um tópico em comunidade que você é membro.',
    trigger: 'Insert em `community_topics`. Notifica os community_members.',
    category: 'content',
    supportedChannels: ['in_app'],
    defaultChannels: ['in_app'],
    wired: false,
  },

  /* ── Engajamento ──────────────────────────────────────── */
  {
    kind: 'achievement_unlocked',
    label: 'Conquista desbloqueada',
    description: 'Usuário atingiu um marco de fanpoints / streak / etc.',
    trigger: 'Lógica de achievements detecta passe de threshold.',
    category: 'engagement',
    supportedChannels: ['in_app'],
    defaultChannels: ['in_app'],
    wired: false,
  },
  {
    kind: 'superfan_promoted',
    label: 'Promovido a superfã',
    description: 'Usuário entrou no top X% de fanpoints.',
    trigger: 'Cron de ranking detecta entrada/saída do top tier.',
    category: 'engagement',
    supportedChannels: ['in_app', 'email'],
    defaultChannels: ['in_app', 'email'],
    wired: false,
  },
  {
    kind: 'streak_warning',
    label: 'Aviso de streak prestes a expirar',
    description: 'Você está prestes a perder uma sequência diária.',
    trigger: 'Cron noturno: usuários com streak_active e sem atividade nas últimas 4h.',
    category: 'engagement',
    supportedChannels: ['in_app'],
    defaultChannels: ['in_app'],
    wired: false,
  },
  {
    kind: 'daily_digest',
    label: 'Resumo diário',
    description:
      'Email noturno (23h59) com fanpoints do dia, distância pro próximo ' +
      'nível e destaques que o usuário pode ter perdido na plataforma. ' +
      'Vai pra TODOS os usuários cadastrados — feature útil enquanto a ' +
      'base é pequena, pode virar opt-in quando escalar.',
    trigger:
      'Cron diário às 23h59 (TZ America/Sao_Paulo). HTTP trigger via ' +
      '/api/cron/daily-digest gated por CRON_SECRET; CLI via ' +
      '`npm run cron:daily-digest`.',
    category: 'engagement',
    supportedChannels: ['email'],
    defaultChannels: ['email'],
    wired: true,
  },
  {
    kind: 'manager_daily_report',
    label: 'Relatório diário do gestor',
    description:
      'Email matinal (06h00) com KPIs da plataforma referentes ao dia ' +
      'anterior: total de usuários cadastrados, novos cadastros, ' +
      'streams, mensagens no chat e tempo médio de sessão. Vai SÓ pro ' +
      'gestor (MANAGER_EMAIL env, default demari.lets@gmail.com).',
    trigger:
      'Cron diário às 06h00 (TZ America/Sao_Paulo). HTTP trigger via ' +
      '/api/cron/manager-report gated por CRON_SECRET; CLI via ' +
      '`npm run cron:manager-report`.',
    category: 'lifecycle',
    supportedChannels: ['email'],
    defaultChannels: ['email'],
    wired: true,
    system: true, // gestor sempre recebe — não dá pra desligar via UI
  },
];

export function getKnownNotification(kind: string): KnownNotification | null {
  return KNOWN_NOTIFICATIONS.find((n) => n.kind === kind) ?? null;
}

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
