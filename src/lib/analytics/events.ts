/**
 * ────────────────────────────────────────────────────────────────────
 *  EVENT REGISTRY — single source of truth for analytics.
 * ────────────────────────────────────────────────────────────────────
 *
 *  Every event the platform fires is declared here with:
 *    - typed payload (compile-time check on every `track()` call site)
 *    - category   — used to group in PostHog + the docs export
 *    - importance — 'critical' | 'high' | 'medium' | 'low'
 *    - description / trigger   — for the auto-generated docs
 *    - ga4        — when true, the same event is mirrored to GA4
 *                   via window.gtag('event', name, props). Keep GA4
 *                   curated (high-level milestones only) so the
 *                   property's GA4 view stays readable.
 *
 *  Naming convention:
 *    - snake_case
 *    - `area_action`           — for area-wide actions
 *    - `area_entity_action`    — when an entity owns the action
 *    - `entity_action`         — when the entity is unambiguous
 *
 *  Examples we already follow:
 *    auth_login_success
 *    feed_post_liked
 *    feed_post_carousel_advanced
 *    comment_created
 *    comment_reaction_toggled
 *    chat_message_sent
 *    player_track_completed
 *    subscription_checkout_started
 *
 *  Versioning:
 *    Don't rename events in place once they're shipped — analyses
 *    break. Either add a new event (e.g. `feed_post_liked_v2`) and
 *    deprecate the old one in a single PR, or extend the existing
 *    payload with optional fields.
 *
 *  Properties:
 *    Every event also carries the global props injected by
 *    AnalyticsProvider (session_id, app_version, is_authenticated,
 *    pathname). The per-event types below describe only the
 *    event-specific properties.
 */

export type EventCategory =
  | 'auth'
  | 'session'
  | 'navigation'
  | 'onboarding'
  | 'feed'
  | 'comment'
  | 'chat'
  | 'player'
  | 'profile'
  | 'search'
  | 'social'
  | 'notification'
  | 'engagement'
  | 'admin'
  | 'monetization';

export type EventImportance = 'critical' | 'high' | 'medium' | 'low';

/** Discriminated map: event name → exact payload shape. New events
 *  go HERE first — the rest of the analytics layer reads from this
 *  type so call sites + docs stay in sync. */
export interface EventPayloadMap {
  // ── AUTH ──────────────────────────────────────────────────────
  auth_login_requested: { method: 'magic_link' | 'spotify' };
  auth_login_success:   { user_id: string; method: 'magic_link' | 'spotify' };
  auth_login_failed:    { reason: string };
  auth_logout:          Record<string, never>;

  // ── SESSION (auto-fired by AnalyticsProvider) ─────────────────
  session_started: { is_authenticated: boolean };
  session_ended:   { duration_seconds: number };

  // ── NAVIGATION (auto-fired) ───────────────────────────────────
  page_view:            { pathname: string; referrer?: string; title?: string };
  screen_view:          { screen_name: string };
  navigation_changed:   { from: string; to: string };

  // ── ONBOARDING ────────────────────────────────────────────────
  onboarding_started:         Record<string, never>;
  onboarding_step_completed:  { step: string; step_index: number };
  onboarding_completed:       { steps_count: number; duration_seconds?: number };
  first_engagement:           { surface: 'feed' | 'chat' | 'player' | 'comment' };

  // ── FEED + POSTS ──────────────────────────────────────────────
  feed_loaded:                  { source: 'admin' | 'mock' | 'mixed'; post_count: number };
  feed_post_viewed:             { post_id?: string; post_key?: string; post_type: string; creator_name?: string };
  feed_post_liked:              { post_id?: string; post_key?: string; creator_name?: string };
  feed_post_unliked:            { post_id?: string; post_key?: string };
  feed_post_carousel_advanced:  { post_id?: string; post_key?: string; from_index: number; to_index: number };
  feed_post_video_played:       { post_id?: string; post_key?: string };
  feed_post_video_muted:        { post_id?: string; post_key?: string; muted: boolean };
  feed_post_shared:             { post_id?: string; post_key?: string; channel?: string };
  /** Poll / Enquete vote — fired when the viewer commits a vote
   *  on a PollPost card. Backend storage doesn't exist yet, so the
   *  event is currently the only paper trail. */
  feed_poll_vote:               { poll_question: string; option_id: string; option_label: string };
  /** Quiz card solved — fired once per card per session when the
   *  viewer clicks "Resolver". `correct` indicates whether the
   *  picked option matched the answer. */
  feed_quiz_solved:             { quiz_question: string; picked_id: string; correct: boolean };

  // ── COMMENTS ──────────────────────────────────────────────────
  comment_created:           { post_id: string; comment_id: string; body_length: number; mention_count: number };
  comment_reply_created:     { post_id: string; parent_comment_id: string; comment_id: string; body_length: number; mention_count: number };
  comment_reaction_toggled:  { comment_id: string; action: 'added' | 'removed'; emoji: string };
  comment_deleted:           { comment_id: string; is_own: boolean };
  comment_replies_expanded:  { comment_id: string; reply_count: number };

  // ── CHAT ──────────────────────────────────────────────────────
  chat_conversation_opened:  { conversation_id: string; conversation_type: 'dm' | 'group' };
  chat_message_sent:         { conversation_id: string; conversation_type: 'dm' | 'group'; body_length: number; mention_count: number };
  chat_message_reacted:      { message_id: string; emoji: string; action: 'added' | 'removed' };
  chat_mention_used:         { conversation_id: string; mention_count: number };
  chat_group_created:        { conversation_id: string; member_count: number };
  chat_group_member_added:   { conversation_id: string };
  chat_group_member_removed: { conversation_id: string };
  chat_group_left:           { conversation_id: string };
  chat_conversation_reported:{ target_user_id: string; source: string };

  // ── PLAYER / LISTENING ────────────────────────────────────────
  player_track_started:    { track_id: string; track_title?: string; artist?: string; album?: string | null };
  player_track_completed:  { track_id: string; track_title?: string; artist?: string; duration_listened_seconds: number };
  player_track_paused:     { track_id: string; position_seconds: number };
  player_track_resumed:    { track_id: string; position_seconds: number };
  player_track_skipped:    { track_id: string; position_seconds: number };
  track_liked:             { track_id: string; track_title: string };
  track_unliked:           { track_id: string };

  // ── PROFILE ───────────────────────────────────────────────────
  profile_viewed:    { profile_user_id: string; is_self: boolean };
  profile_edited:    { fields_changed: string[] };
  avatar_uploaded:   Record<string, never>;
  avatar_removed:    Record<string, never>;

  // ── SEARCH ────────────────────────────────────────────────────
  search_performed:        { query_length: number; scope: 'users' | 'tracks' | 'global' };
  search_result_clicked:   { query_length: number; result_type: string; position: number };

  // ── SOCIAL ────────────────────────────────────────────────────
  /** Heart "aceno" sent from the expanded user marker on the
   *  Globe map. Fires when the viewer toggles the heart ON. The
   *  backend POST /api/wave endpoint will land in a follow-up;
   *  the event is the only paper trail until then. */
  user_waved:          { target_user_id: string; target_user_name?: string; source: 'globe_marker' | 'profile_panel' };
  /** Symmetric un-wave — when the viewer toggles the same heart
   *  OFF. Low importance; useful for distinguishing "changed mind"
   *  from "engaged" in funnel reports. */
  user_unwaved:        { target_user_id: string; source: 'globe_marker' | 'profile_panel' };
  creator_followed:    { creator_user_id: string };
  creator_unfollowed:  { creator_user_id: string };
  content_shared:      { content_type: 'post' | 'track' | 'profile'; channel: string };
  invite_sent:         { channel: string };

  // ── NOTIFICATIONS ─────────────────────────────────────────────
  notification_received:   { kind: string };
  notification_opened:     { kind: string; notification_id: string };
  notification_dismissed:  { kind: string; notification_id: string };
  notifications_all_read:  { count: number };

  // ── ENGAGEMENT (auto-fired) ───────────────────────────────────
  scroll_depth:   { depth_percent: 25 | 50 | 75 | 100; pathname: string };
  time_on_screen: { screen_name: string; seconds: number };
  button_clicked: { id: string; pathname: string };

  // ── ADMIN ─────────────────────────────────────────────────────
  admin_feed_post_created:   { post_id: string; type: string; action: 'publish' | 'schedule' | 'draft' };
  admin_feed_post_updated:   { post_id: string; action: 'publish' | 'schedule' | 'draft' };
  admin_feed_post_published: { post_id: string };
  admin_feed_post_deleted:   { post_id: string };
  admin_site_tag_updated:    { kind: string; enabled: boolean };

  // ── MONETIZATION (future-proof) ───────────────────────────────
  subscription_checkout_started: { plan: string };
  subscription_started:          { plan: string; trial: boolean };
  subscription_renewed:          { plan: string; amount_cents: number; currency: string };
  subscription_canceled:         { plan: string; reason?: string };
  purchase_completed:            { sku: string; amount_cents: number; currency: string };
}

/** All known event names — derived, so it stays in sync with the map. */
export type EventName = keyof EventPayloadMap;

/** Per-event metadata used by the analytics router + the docs generator. */
export interface EventMeta {
  category: EventCategory;
  importance: EventImportance;
  /** Short human description for the docs table. */
  description: string;
  /** When exactly is this event fired? */
  trigger: string;
  /** Send the same event to GA4 via window.gtag('event', ...). Keep
   *  this list short — GA4 is the "exec dashboard"; PostHog gets
   *  every event for fine-grained analysis. */
  ga4?: boolean;
}

export const EVENT_META: Record<EventName, EventMeta> = {
  // Auth
  auth_login_requested: { category: 'auth', importance: 'high', description: 'Usuário pediu link mágico ou iniciou OAuth.', trigger: 'POST /api/auth/request submetido com sucesso.' },
  auth_login_success:   { category: 'auth', importance: 'critical', description: 'Sessão de usuário criada com sucesso.', trigger: 'Cookie de sessão emitido após magic-link / Spotify.', ga4: true },
  auth_login_failed:    { category: 'auth', importance: 'high', description: 'Tentativa de login rejeitada.', trigger: 'Resposta 4xx do endpoint de auth.' },
  auth_logout:          { category: 'auth', importance: 'medium', description: 'Usuário encerrou a sessão manualmente.', trigger: 'Botão "Sair" clicado no menu/dock.' },

  // Session
  session_started: { category: 'session', importance: 'high', description: 'Início de sessão analítica (primeira interação após carregar a página).', trigger: 'AnalyticsProvider monta no app.', ga4: true },
  session_ended:   { category: 'session', importance: 'high', description: 'Sessão encerrada (visibilitychange=hidden ou beforeunload).', trigger: 'AnalyticsProvider detecta saída.', ga4: true },

  // Navigation
  page_view:            { category: 'navigation', importance: 'high', description: 'Página carregada / SPA navegação concluída.', trigger: 'usePathname() muda OU primeiro mount.', ga4: true },
  screen_view:          { category: 'navigation', importance: 'medium', description: 'Tela lógica (painel/aba) trocada.', trigger: 'Tab/painel ativo muda em /app ou /admin.' },
  navigation_changed:   { category: 'navigation', importance: 'low', description: 'Transição entre dois pathnames.', trigger: 'AnalyticsProvider intercepta mudança de rota.' },

  // Onboarding
  onboarding_started:        { category: 'onboarding', importance: 'high', description: 'Usuário recém-criado entra no fluxo de onboarding.', trigger: 'Tela /app/select ou primeiro mount pós-cadastro.', ga4: true },
  onboarding_step_completed: { category: 'onboarding', importance: 'medium', description: 'Etapa concreta do onboarding terminada.', trigger: 'CTA do step disparado.' },
  onboarding_completed:      { category: 'onboarding', importance: 'critical', description: 'Onboarding chegou ao fim.', trigger: 'Última tela do fluxo concluída.', ga4: true },
  first_engagement:          { category: 'onboarding', importance: 'critical', description: 'Primeira interação real do usuário (curtir, comentar, mandar mensagem, dar play).', trigger: 'Detectado uma única vez por user_id.', ga4: true },

  // Feed
  feed_loaded:                 { category: 'feed', importance: 'medium', description: 'Painel de feed terminou o carregamento inicial.', trigger: 'FeedPanel monta + admin posts hidratados.' },
  feed_post_viewed:            { category: 'feed', importance: 'medium', description: 'Post de feed entrou na viewport por >1s.', trigger: 'IntersectionObserver dispara para o MediaPost.' },
  feed_post_liked:             { category: 'feed', importance: 'high', description: 'Usuário curtiu um post (heart no MediaPost).', trigger: 'Botão de like alternado para liked=true.', ga4: true },
  feed_post_unliked:           { category: 'feed', importance: 'low', description: 'Usuário retirou o like.', trigger: 'Botão de like alternado para liked=false.' },
  feed_post_carousel_advanced: { category: 'feed', importance: 'medium', description: 'Usuário avançou um slide no carousel.', trigger: 'Chevron clicado ou dot de página selecionado.' },
  feed_post_video_played:      { category: 'feed', importance: 'medium', description: 'Vídeo do feed começou a tocar.', trigger: 'Botão de play do MediaPost.' },
  feed_post_video_muted:       { category: 'feed', importance: 'low', description: 'Estado de mute do vídeo alternado.', trigger: 'Botão de áudio do MediaPost.' },
  feed_post_shared:            { category: 'feed', importance: 'high', description: 'Compartilhamento de post para fora do app.', trigger: 'Ação de share / cópia de link.', ga4: true },
  feed_poll_vote:              { category: 'feed', importance: 'high', description: 'Voto em uma enquete (PollPost) do feed.', trigger: 'Botão "Votar" clicado em uma opção.', ga4: true },
  feed_quiz_solved:            { category: 'feed', importance: 'high', description: 'Quiz do feed respondido (acertou ou errou).', trigger: 'Botão "Resolver" do QuizPost clicado com uma opção selecionada.', ga4: true },

  // Comments
  comment_created:          { category: 'comment', importance: 'critical', description: 'Comentário de primeiro nível criado.', trigger: 'POST /api/feed/posts/:postKey/comments aceito.', ga4: true },
  comment_reply_created:    { category: 'comment', importance: 'high', description: 'Resposta a um comentário criada.', trigger: 'POST /api/feed/comments/:id/replies aceito.', ga4: true },
  comment_reaction_toggled: { category: 'comment', importance: 'high', description: 'Reação ❤️ adicionada/removida em um comentário.', trigger: 'POST /api/feed/comments/:id/reactions retorna sucesso.' },
  comment_deleted:          { category: 'comment', importance: 'medium', description: 'Comentário deletado (autor ou moderador).', trigger: 'DELETE /api/feed/comments/:id aceito.' },
  comment_replies_expanded: { category: 'comment', importance: 'low', description: 'Usuário abriu a thread de respostas.', trigger: 'Botão "Ver respostas" clicado.' },

  // Chat
  chat_conversation_opened:  { category: 'chat', importance: 'medium', description: 'Conversa selecionada/aberta no painel.', trigger: 'LiveChatPanel hidrata uma conversa.' },
  chat_message_sent:         { category: 'chat', importance: 'critical', description: 'Mensagem enviada (DM ou grupo).', trigger: 'chat:send emite com ack ok.', ga4: true },
  chat_message_reacted:      { category: 'chat', importance: 'medium', description: 'Reação em uma mensagem alternada.', trigger: 'chat:react emite com ack ok.' },
  chat_mention_used:         { category: 'chat', importance: 'high', description: 'Mensagem com pelo menos um @mention.', trigger: 'chat:send com mention_count > 0.' },
  chat_group_created:        { category: 'chat', importance: 'high', description: 'Grupo criado.', trigger: 'POST /api/conversations type=group aceito.', ga4: true },
  chat_group_member_added:   { category: 'chat', importance: 'medium', description: 'Membro adicionado a um grupo.', trigger: 'POST /api/conversations/:id/members aceito.' },
  chat_group_member_removed: { category: 'chat', importance: 'medium', description: 'Membro removido de um grupo (kick).', trigger: 'DELETE /api/conversations/:id/members/:userId aceito.' },
  chat_group_left:           { category: 'chat', importance: 'medium', description: 'Usuário saiu do grupo voluntariamente.', trigger: 'Mesma rota, com userId = self.' },
  chat_conversation_reported:{ category: 'chat', importance: 'high', description: 'Denúncia submetida pelo kebab da conversa.', trigger: 'POST /api/reports aceito.' },

  // Player
  player_track_started:   { category: 'player', importance: 'critical', description: 'Play começou em uma faixa.', trigger: 'recordListeningTick detecta troca de track.', ga4: true },
  player_track_completed: { category: 'player', importance: 'high', description: 'Faixa concluída (chegou ao fim).', trigger: 'listeningHistory.completed=true.', ga4: true },
  player_track_paused:    { category: 'player', importance: 'low', description: 'Faixa pausada.', trigger: 'Toggle do botão pause/play.' },
  player_track_resumed:   { category: 'player', importance: 'low', description: 'Play retomado.', trigger: 'Toggle do botão pause/play.' },
  player_track_skipped:   { category: 'player', importance: 'medium', description: 'Usuário pulou a faixa antes do fim.', trigger: 'Skip ou troca manual de música.' },
  track_liked:            { category: 'player', importance: 'high', description: 'Faixa curtida no player.', trigger: 'POST /api/me/tracks/:id/like aceito.', ga4: true },
  track_unliked:          { category: 'player', importance: 'low', description: 'Like removido de uma faixa.', trigger: 'DELETE no mesmo endpoint.' },

  // Profile
  profile_viewed:  { category: 'profile', importance: 'medium', description: 'Painel de perfil aberto.', trigger: 'Navegação para /app?profile=<id>.' },
  profile_edited:  { category: 'profile', importance: 'medium', description: 'Campos do perfil salvos com sucesso.', trigger: 'PATCH /api/me/profile aceito.' },
  avatar_uploaded: { category: 'profile', importance: 'medium', description: 'Foto de perfil enviada/substituída.', trigger: 'POST /api/me/avatar aceito.' },
  avatar_removed:  { category: 'profile', importance: 'low', description: 'Foto de perfil removida.', trigger: 'DELETE /api/me/avatar aceito.' },

  // Search
  search_performed:      { category: 'search', importance: 'medium', description: 'Usuário executou uma busca.', trigger: 'Submit do input de busca / debounce 350ms.' },
  search_result_clicked: { category: 'search', importance: 'high', description: 'Usuário clicou em um resultado.', trigger: 'Item da lista de resultados ativado.' },

  // Social
  user_waved:         { category: 'social', importance: 'high', description: 'Aceno (heart) enviado via marker no globo ou painel de perfil.', trigger: 'Botão de coração clicado para o estado "liked".', ga4: true },
  user_unwaved:       { category: 'social', importance: 'low', description: 'Aceno desfeito.', trigger: 'Botão de coração clicado para o estado "unliked".' },
  creator_followed:   { category: 'social', importance: 'high', description: 'Usuário começou a seguir um perfil.', trigger: 'CTA "Seguir" ativado.', ga4: true },
  creator_unfollowed: { category: 'social', importance: 'low', description: 'Usuário deixou de seguir um perfil.', trigger: 'CTA "Seguindo" desfeito.' },
  content_shared:     { category: 'social', importance: 'high', description: 'Conteúdo compartilhado para fora do app.', trigger: 'navigator.share() ou copy-link.', ga4: true },
  invite_sent:        { category: 'social', importance: 'high', description: 'Convite enviado para um novo usuário.', trigger: 'Fluxo de convite concluído.', ga4: true },

  // Notifications
  notification_received:  { category: 'notification', importance: 'medium', description: 'Notificação chegou ao cliente via socket ou poll.', trigger: 'NotificationBell recebe novo item.' },
  notification_opened:    { category: 'notification', importance: 'high', description: 'Notificação clicada / lida.', trigger: 'Item da bell clicado.' },
  notification_dismissed: { category: 'notification', importance: 'low', description: 'Notificação dispensada sem abrir.', trigger: 'Ação de dismiss / swipe.' },
  notifications_all_read: { category: 'notification', importance: 'low', description: 'Usuário marcou todas como lidas de uma vez.', trigger: 'CTA "Marcar todas".' },

  // Engagement (auto)
  scroll_depth:   { category: 'engagement', importance: 'low', description: 'Marco de profundidade de scroll atingido (25/50/75/100).', trigger: 'AnalyticsProvider dispara uma vez por marco por pathname.' },
  time_on_screen: { category: 'engagement', importance: 'low', description: 'Tempo gasto em uma tela lógica.', trigger: 'AnalyticsProvider dispara ao trocar de screen.' },
  button_clicked: { category: 'engagement', importance: 'low', description: 'Clique em qualquer elemento com data-analytics-id.', trigger: 'AnalyticsProvider escuta clicks no document.' },

  // Admin
  admin_feed_post_created:   { category: 'admin', importance: 'high', description: 'Post criado pelo admin (/admin/feed).', trigger: 'POST /api/admin/feed retorna 201.' },
  admin_feed_post_updated:   { category: 'admin', importance: 'medium', description: 'Post existente editado pelo admin.', trigger: 'PATCH /api/admin/feed/:id retorna 200.' },
  admin_feed_post_published: { category: 'admin', importance: 'high', description: 'Post agendado/rascunho publicado manualmente.', trigger: 'POST /api/admin/feed/:id/publish.' },
  admin_feed_post_deleted:   { category: 'admin', importance: 'medium', description: 'Post deletado pelo admin.', trigger: 'DELETE /api/admin/feed/:id.' },
  admin_site_tag_updated:    { category: 'admin', importance: 'medium', description: 'Pixel/tag de tracking atualizado em /admin/settings → Tags.', trigger: 'PATCH /api/admin/site-tags/:kind.' },

  // Monetization (future)
  subscription_checkout_started: { category: 'monetization', importance: 'critical', description: 'Usuário iniciou checkout de assinatura.', trigger: 'Botão "Assinar" no plano selecionado.', ga4: true },
  subscription_started:          { category: 'monetization', importance: 'critical', description: 'Assinatura ativada (pagamento confirmado).', trigger: 'Webhook do gateway recebido.', ga4: true },
  subscription_renewed:          { category: 'monetization', importance: 'high', description: 'Renovação de assinatura processada.', trigger: 'Webhook recorrente.', ga4: true },
  subscription_canceled:         { category: 'monetization', importance: 'high', description: 'Assinatura cancelada pelo usuário.', trigger: 'Webhook ou ação direta.', ga4: true },
  purchase_completed:            { category: 'monetization', importance: 'critical', description: 'Compra avulsa concluída.', trigger: 'Webhook do gateway.', ga4: true },
};

/** Helper: should this event also forward to GA4? */
export function shouldMirrorToGa4(event: EventName): boolean {
  return Boolean(EVENT_META[event]?.ga4);
}

/** Helper: the category of an event — used by the client for
 *  routing + by the docs generator. */
export function categoryOf(event: EventName): EventCategory {
  return EVENT_META[event].category;
}
