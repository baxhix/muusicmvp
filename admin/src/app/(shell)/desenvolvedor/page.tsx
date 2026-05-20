'use client';

import { useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import {
  IconSearch,
  IconKey,
  IconChevronRight,
  IconCode,
} from '@/components/icons';
import TagsManager from '@/components/admin/TagsManager';
import styles from './page.module.css';

/**
 * Estrutura tabada per product feedback "adicione tabs na aba de
 * Desenvolvedor também e leve o item de Tags para lá e crie uma
 * para o swagger":
 *   - Endpoints — catálogo manual de REST + Socket.IO (conteúdo
 *     original da página, abaixo)
 *   - Tags     — tags de rastreamento, movido do Configurações
 *   - Swagger  — referência OpenAPI/Swagger (stub por enquanto)
 */
type DevTab = 'endpoints' | 'tags' | 'swagger';

const DEV_TABS: { id: DevTab; label: string }[] = [
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'tags',      label: 'Tags' },
  { id: 'swagger',   label: 'Swagger' },
];

/**
 * Developer reference — catalog of the platform's REST + Socket
 * endpoints. The mobile team uses this surface to scope what's
 * already integrated, what's stable, and what's planned, without
 * having to grep through the web codebase.
 *
 * The entries are hand-curated mirrors of the actual routes under
 * `src/app/api/` + the realtime Socket.IO events. When a new
 * endpoint ships, add it here so the docs stay current — the page
 * is intentionally simple (single source array, filter on top,
 * accordion rows) so adding stuff is a one-liner.
 *
 * Long-term we'll auto-generate this from route handler annotations,
 * but until the public app is stable the manual catalog stays
 * authoritative.
 */

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
type EndpointStatus = 'stable' | 'beta' | 'deprecated' | 'planned';
type EndpointArea =
  | 'auth'
  | 'feed'
  | 'comments'
  | 'chat'
  | 'tracks'
  | 'users'
  | 'profile'
  | 'notifications'
  | 'admin'
  | 'storage'
  | 'socket'
  | 'system';

type EndpointAuth = 'public' | 'user' | 'admin';

interface Endpoint {
  method: HttpMethod | 'WS';
  path: string;
  area: EndpointArea;
  status: EndpointStatus;
  auth: EndpointAuth;
  summary: string;
  description: string;
  /** Plain-text examples (rendered inside <pre>). Keep them small. */
  request?: string;
  response?: string;
  /** When set, marks the field operators care about for mobile
   *  parity (e.g. "iOS app uses this in onboarding flow"). */
  mobileNote?: string;
}

const AREA_LABEL: Record<EndpointArea, string> = {
  auth:          'Autenticação',
  feed:          'Feed',
  comments:      'Comentários',
  chat:          'Chat',
  tracks:        'Músicas',
  users:         'Usuários',
  profile:       'Perfil',
  notifications: 'Notificações',
  admin:         'Admin',
  storage:       'Storage',
  socket:        'Realtime (Socket.IO)',
  system:        'Sistema',
};

const STATUS_LABEL: Record<EndpointStatus, string> = {
  stable:     'Estável',
  beta:       'Beta',
  deprecated: 'Deprecado',
  planned:    'Planejado',
};

const STATUS_TONE: Record<EndpointStatus, 'success' | 'info' | 'warning' | 'neutral'> = {
  stable:     'success',
  beta:       'info',
  deprecated: 'warning',
  planned:    'neutral',
};

const METHOD_TONE: Record<string, string> = {
  GET:    styles.methodGet,
  POST:   styles.methodPost,
  PATCH:  styles.methodPatch,
  DELETE: styles.methodDelete,
  PUT:    styles.methodPatch,
  WS:     styles.methodWs,
};

/* ── Catalog (hand-curated) ─────────────────────────────────
 * Source of truth: src/app/api/** + socket-server/ src.
 * Update when shipping new routes. */

const ENDPOINTS: Endpoint[] = [
  /* ── auth ── */
  {
    method: 'POST', path: '/api/auth/request', area: 'auth', status: 'stable', auth: 'public',
    summary: 'Solicita o envio de um magic-link de login por email.',
    description: 'Aceita { email } e devolve { ok: true } se o email é válido. O link expira em 15 min.',
    request:  `POST /api/auth/request\nContent-Type: application/json\n\n{ "email": "fan@exemplo.com" }`,
    response: `200 OK\n{ "ok": true }`,
    mobileNote: 'Mobile usa exatamente o mesmo endpoint — só precisa estar no domínio cujo deep-link aponta de volta pro app.',
  },
  {
    method: 'POST', path: '/api/auth/verify', area: 'auth', status: 'stable', auth: 'public',
    summary: 'Troca o token do magic-link por uma sessão.',
    description: 'Aceita { token } extraído da URL do email. Em sucesso, seta cookie de sessão (httpOnly) e devolve o usuário.',
    request:  `POST /api/auth/verify\n\n{ "token": "abc..." }`,
    response: `200 OK + Set-Cookie: session=...\n{ "user": { "id": "...", "email": "...", "name": "..." } }`,
  },
  {
    method: 'GET', path: '/api/auth/me', area: 'auth', status: 'stable', auth: 'user',
    summary: 'Retorna o usuário da sessão corrente.',
    description: 'Lê o cookie de sessão e devolve o user logado. 401 quando o cookie é inválido/ausente.',
    response: `200 OK\n{ "user": { "id": "...", "email": "...", "name": "...", "role": "user|admin" } }`,
  },
  {
    method: 'POST', path: '/api/auth/logout', area: 'auth', status: 'stable', auth: 'user',
    summary: 'Encerra a sessão atual.',
    description: 'Invalida o token de sessão server-side e limpa o cookie.',
    response: `200 OK\n{ "ok": true }`,
  },

  /* ── feed ── */
  {
    method: 'GET', path: '/api/feed/posts', area: 'feed', status: 'stable', auth: 'user',
    summary: 'Lista de posts publicados do feed.',
    description: 'Aceita ?limit, ?offset, ?type=story|video|... — filtra apenas published+active+não-expirados.',
    response: `200 OK\n{ "items": [ ApiFeedPost, ... ] }`,
  },
  {
    method: 'POST', path: '/api/feed/posts/:postKey/comments', area: 'comments', status: 'stable', auth: 'user',
    summary: 'Cria comentário em um post.',
    description: 'Aceita { body }. Suporta menções com sintaxe @[Nome](uuid). Devolve id + postId do comentário.',
    request:  `POST /api/feed/posts/feed:abc-123/comments\n\n{ "body": "Top demais!" }`,
    response: `201 Created\n{ "id": "...", "postId": "..." }`,
    mobileNote: 'Atenção: postKey é a chave externa do post (não o id interno). Use o postKey vindo do listing.',
  },
  {
    method: 'POST', path: '/api/feed/comments/:id/replies', area: 'comments', status: 'stable', auth: 'user',
    summary: 'Responde a um comentário existente.',
    description: 'Mesma estrutura do POST de comments, mas atrelado ao parent comment.',
  },
  {
    method: 'POST', path: '/api/feed/comments/:id/reactions', area: 'comments', status: 'stable', auth: 'user',
    summary: 'Toggle de reação (❤️) em comentário.',
    description: 'Devolve { count, mine, action: "added"|"removed" }.',
    response: `200 OK\n{ "count": 12, "mine": true, "action": "added" }`,
  },
  {
    method: 'DELETE', path: '/api/feed/comments/:id', area: 'comments', status: 'stable', auth: 'user',
    summary: 'Deleta um comentário próprio (ou admin).',
    description: 'Hard-delete. Cascade nas replies. 403 se não é dono nem admin.',
  },
  {
    method: 'GET', path: '/api/feed/images/:filename', area: 'storage', status: 'stable', auth: 'public',
    summary: 'Serve imagem armazenada no feed.',
    description: 'Whitelist de filename evita path traversal. Cache imutável por 1 ano.',
  },
  {
    method: 'GET', path: '/api/feed/videos/:filename', area: 'storage', status: 'stable', auth: 'public',
    summary: 'Serve vídeo armazenado no feed.',
    description: 'Mesmo padrão das imagens. Aceita Range header (futuro). MIME: mp4/webm/mov/ogv.',
  },

  /* ── chat ── */
  {
    method: 'GET', path: '/api/conversations', area: 'chat', status: 'stable', auth: 'user',
    summary: 'Lista as conversas (DMs + grupos) do usuário.',
    description: 'Inclui contador de não-lidas e snippet da última mensagem.',
  },
  {
    method: 'POST', path: '/api/conversations', area: 'chat', status: 'stable', auth: 'user',
    summary: 'Cria conversa nova (DM ou grupo).',
    description: 'Para DM, manda { type:"dm", peerUserId }. Para grupo, { type:"group", name, memberIds }.',
  },
  {
    method: 'POST', path: '/api/conversations/:id/messages', area: 'chat', status: 'stable', auth: 'user',
    summary: 'Envia mensagem via REST (fallback do socket).',
    description: 'Aceita { body }. Usado quando o cliente está offline para o socket. A versão socket é preferida.',
    mobileNote: 'No mobile, priorize o socket (chat:send) para ter eco em tempo real. Só use o REST como fallback.',
  },
  {
    method: 'POST', path: '/api/conversations/:id/read', area: 'chat', status: 'stable', auth: 'user',
    summary: 'Marca todas mensagens da conversa como lidas.',
    description: 'Idempotente. Persiste o last_read_message_id.',
  },
  {
    method: 'WS', path: 'chat:send', area: 'socket', status: 'stable', auth: 'user',
    summary: 'Envia mensagem em tempo real.',
    description: 'Payload: { conversationId, body }. Server persiste + broadcasta. Use ack callback para confirmar.',
    request: `socket.emit('chat:send', { conversationId, body }, (ack) => {\n  if (ack.ok) { /* sent */ }\n});`,
  },
  {
    method: 'WS', path: 'chat:react', area: 'socket', status: 'stable', auth: 'user',
    summary: 'Toggle de reação a mensagem.',
    description: 'Payload: { messageId, emoji }. Broadcast volta como chat:reaction.',
  },
  {
    method: 'WS', path: 'chat:join / chat:leave', area: 'socket', status: 'stable', auth: 'user',
    summary: 'Entra/sai da room de uma conversa.',
    description: 'Necessário para receber broadcasts daquela conversa.',
  },

  /* ── tracks + listening ── */
  {
    method: 'GET', path: '/api/tracks', area: 'tracks', status: 'stable', auth: 'user',
    summary: 'Catálogo de músicas disponíveis.',
    description: 'Devolve array com id, title, artist, album, youtubeId, durationSeconds.',
  },
  {
    method: 'POST', path: '/api/listening/event', area: 'tracks', status: 'stable', auth: 'user',
    summary: 'Tick de listening (fallback REST do socket).',
    description: 'Aceita { youtubeId, positionSeconds, isPaused }. Server reconcilia now_playing.',
  },
  {
    method: 'WS', path: 'listening:tick', area: 'socket', status: 'stable', auth: 'user',
    summary: 'Tick de listening em tempo real.',
    description: 'Mesma payload do REST. Emite a cada ~10s enquanto a música toca.',
  },
  {
    method: 'WS', path: 'listening:stop', area: 'socket', status: 'stable', auth: 'user',
    summary: 'Limpa o now_playing do usuário.',
    description: 'Dispare quando pause prolongado ou troca pra silêncio.',
  },

  /* ── users + profile ── */
  {
    method: 'GET', path: '/api/users/:id/profile', area: 'profile', status: 'stable', auth: 'user',
    summary: 'Perfil público de um usuário.',
    description: 'Inclui contagem de seguidores, top artists, atividade recente (limitada).',
  },
  {
    method: 'GET', path: '/api/users/online', area: 'users', status: 'stable', auth: 'user',
    summary: 'Snapshot de usuários online no momento.',
    description: 'Última-vista < 60s. Inclui lat/lng aproximadas para o globe.',
  },
  {
    method: 'GET', path: '/api/users/search', area: 'users', status: 'stable', auth: 'user',
    summary: 'Busca textual de usuários.',
    description: 'Aceita ?q=. Usado para autocomplete de menções.',
  },
  {
    method: 'PATCH', path: '/api/me/profile', area: 'profile', status: 'stable', auth: 'user',
    summary: 'Atualiza dados do próprio perfil.',
    description: 'Aceita { name, bio, city, etc. }. Patch parcial.',
  },
  {
    method: 'POST', path: '/api/me/avatar', area: 'profile', status: 'stable', auth: 'user',
    summary: 'Upload da foto de perfil.',
    description: 'multipart/form-data com campo `file`. Limite 5MB. Retorna { url }.',
  },

  /* ── notifications ── */
  {
    method: 'GET', path: '/api/notifications', area: 'notifications', status: 'stable', auth: 'user',
    summary: 'Lista de notificações do usuário.',
    description: 'Aceita ?limit, ?cursor. Notificações já lidas vêm com isRead=true.',
  },
  {
    method: 'POST', path: '/api/notifications/read-all', area: 'notifications', status: 'stable', auth: 'user',
    summary: 'Marca todas como lidas.',
    description: 'Resposta { count } indica quantas foram afetadas.',
  },

  /* ── reports ── */
  {
    method: 'POST', path: '/api/reports', area: 'system', status: 'stable', auth: 'user',
    summary: 'Denúncia de conteúdo / usuário.',
    description: 'Aceita { kind, targetId, reason, description, imageUrl? }.',
  },

  /* ── admin ── */
  {
    method: 'GET', path: '/api/admin/feed', area: 'admin', status: 'stable', auth: 'admin',
    summary: 'CMS de feed (listagem com filtros).',
    description: 'Aceita ?status, ?type, ?search, ?limit, ?offset.',
  },
  {
    method: 'POST', path: '/api/admin/feed', area: 'admin', status: 'stable', auth: 'admin',
    summary: 'Criar post no feed.',
    description: 'Aceita body completo (type, title, description, media[], scheduledAt, expiresAt, action).',
  },
  {
    method: 'POST', path: '/api/admin/feed/upload', area: 'admin', status: 'stable', auth: 'admin',
    summary: 'Upload de imagem para feed.',
    description: 'multipart/form-data, campo `file`. Aceita JPG/PNG/WEBP/GIF até 8MB.',
  },
  {
    method: 'POST', path: '/api/admin/feed/upload-video', area: 'admin', status: 'stable', auth: 'admin',
    summary: 'Upload de vídeo para feed.',
    description: 'multipart/form-data, campo `file`. Aceita MP4/WebM/MOV/OGV até 100MB.',
  },
  {
    method: 'GET', path: '/api/admin/users', area: 'admin', status: 'planned', auth: 'admin',
    summary: 'Lista paginada de usuários (admin).',
    description: 'Endpoint planejado — hoje a tela /admin/users consome mock client-side.',
  },
  {
    method: 'GET', path: '/api/admin/users/:id/activities', area: 'admin', status: 'planned', auth: 'admin',
    summary: 'Log de atividades do usuário (compliance).',
    description: 'Endpoint planejado para a página /admin/users/[id]/activities. Hoje consome mock determinístico.',
  },
  {
    method: 'GET', path: '/api/site-tags/public', area: 'system', status: 'stable', auth: 'public',
    summary: 'Pixels + chaves de tracking ativos.',
    description: 'Lido client-side por TrackingTags + AnalyticsProvider para inicializar PostHog, Clarity, GA, etc.',
  },
];

const STATUS_OPTIONS = [
  { value: 'all',        label: 'Todos status' },
  { value: 'stable',     label: 'Estáveis' },
  { value: 'beta',       label: 'Beta' },
  { value: 'planned',    label: 'Planejados' },
  { value: 'deprecated', label: 'Deprecados' },
];

const AREA_OPTIONS = [
  { value: 'all', label: 'Todas as áreas' },
  ...Object.entries(AREA_LABEL).map(([value, label]) => ({ value, label })),
];

const AUTH_OPTIONS = [
  { value: 'all',    label: 'Todos auth' },
  { value: 'public', label: 'Público' },
  { value: 'user',   label: 'Usuário' },
  { value: 'admin',  label: 'Admin' },
];

const AUTH_LABEL: Record<EndpointAuth, string> = {
  public: 'Público',
  user:   'Usuário',
  admin:  'Admin',
};

export default function DesenvolvedorPage() {
  const [tab, setTab] = useState<DevTab>('endpoints');

  return (
    <div className={styles.page}>
      <PageHeader
        title="Desenvolvedor"
        description="Referência técnica do Fanverse: endpoints REST/Socket, tags de rastreamento e documentação OpenAPI."
        tabs={
          <Tabs<DevTab>
            variant="bordered"
            items={DEV_TABS}
            value={tab}
            onChange={setTab}
          />
        }
      />

      {tab === 'endpoints' && <EndpointsTab />}
      {tab === 'tags'      && <TagsManager />}
      {tab === 'swagger'   && <SwaggerTab />}
    </div>
  );
}

/* ============================================================
   Tab: Endpoints (conteúdo original da página)
   ============================================================ */

function EndpointsTab() {
  const [search, setSearch] = useState('');
  const [area, setArea] = useState<EndpointArea | 'all'>('all');
  const [status, setStatus] = useState<EndpointStatus | 'all'>('all');
  const [auth, setAuth] = useState<EndpointAuth | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ENDPOINTS.filter((e) => {
      if (area !== 'all' && e.area !== area) return false;
      if (status !== 'all' && e.status !== status) return false;
      if (auth !== 'all' && e.auth !== auth) return false;
      if (q) {
        const hay = `${e.method} ${e.path} ${e.summary} ${e.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [search, area, status, auth]);

  // Group by area for readability — a flat list of 30+ items is
  // harder to skim than 8 sub-headers.
  const grouped = useMemo(() => {
    const out = new Map<EndpointArea, Endpoint[]>();
    for (const e of filtered) {
      const list = out.get(e.area) ?? [];
      list.push(e);
      out.set(e.area, list);
    }
    return Array.from(out.entries());
  }, [filtered]);

  return (
    <>
      {/* ── Filtros ──────────────────────────────────────── */}
      <Card className={styles.filters}>
        <Input
          inputSize="md"
          placeholder="Buscar por path, método, descrição…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leadingIcon={<IconSearch size={14} />}
        />
        <Select
          value={area}
          onChange={(e) => setArea(e.target.value as EndpointArea | 'all')}
          options={AREA_OPTIONS}
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as EndpointStatus | 'all')}
          options={STATUS_OPTIONS}
        />
        <Select
          value={auth}
          onChange={(e) => setAuth(e.target.value as EndpointAuth | 'all')}
          options={AUTH_OPTIONS}
        />
      </Card>

      <div className={styles.summary}>
        {filtered.length} endpoint(s) · {grouped.length} área(s)
      </div>

      {/* ── Lista agrupada por área ─────────────────────── */}
      {grouped.length === 0 ? (
        <Card className={styles.empty}>Nenhum endpoint encontrado com esses filtros.</Card>
      ) : (
        grouped.map(([areaKey, items]) => (
          <Card key={areaKey} className={styles.group}>
            <header className={styles.groupHeader}>
              <h2 className={styles.groupTitle}>{AREA_LABEL[areaKey]}</h2>
              <span className={styles.groupCount}>{items.length}</span>
            </header>
            <div className={styles.endpoints}>
              {items.map((ep) => {
                const id = `${ep.method}:${ep.path}`;
                const open = expanded === id;
                return (
                  <article key={id} className={styles.endpoint}>
                    <button
                      type="button"
                      className={styles.endpointHead}
                      onClick={() => setExpanded(open ? null : id)}
                      aria-expanded={open}
                    >
                      <span className={`${styles.method} ${METHOD_TONE[ep.method]}`}>
                        {ep.method}
                      </span>
                      <code className={styles.path}>{ep.path}</code>
                      <span className={styles.summary2}>{ep.summary}</span>
                      <span className={styles.endpointMeta}>
                        <Badge tone={STATUS_TONE[ep.status]} size="sm">
                          {STATUS_LABEL[ep.status]}
                        </Badge>
                        <span className={styles.authChip} title={`Auth: ${AUTH_LABEL[ep.auth]}`}>
                          <IconKey size={11} />
                          {AUTH_LABEL[ep.auth]}
                        </span>
                        <IconChevronRight
                          size={14}
                          style={{
                            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 120ms',
                            color: 'var(--text-mute)',
                          }}
                        />
                      </span>
                    </button>
                    {open && (
                      <div className={styles.endpointBody}>
                        <p className={styles.description}>{ep.description}</p>
                        {ep.mobileNote && (
                          <div className={styles.mobileNote}>
                            <strong>Nota mobile:</strong> {ep.mobileNote}
                          </div>
                        )}
                        {ep.request && (
                          <div className={styles.snippet}>
                            <span className={styles.snippetLabel}>Request</span>
                            <pre><code>{ep.request}</code></pre>
                          </div>
                        )}
                        {ep.response && (
                          <div className={styles.snippet}>
                            <span className={styles.snippetLabel}>Response</span>
                            <pre><code>{ep.response}</code></pre>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </Card>
        ))
      )}
    </>
  );
}

/* ============================================================
   Tab: Swagger / OpenAPI
   ============================================================ */

function SwaggerTab() {
  return (
    <Card>
      <CardHeader
        title="Swagger / OpenAPI"
        description="Spec autogerado a partir dos route handlers. A versão completa, navegável e com 'try it out', vai aparecer aqui assim que a geração de spec for ativada no pipeline."
      />
      <EmptyState
        icon={<IconCode size={20} />}
        title="Spec OpenAPI em construção"
        description="Hoje o catálogo de Endpoints (tab ao lado) é a fonte de verdade — escrito à mão. Quando o gerador de OpenAPI cair no build, esta aba carregará o Swagger UI apontando para /openapi.json com schemas, exemplos e botão de execução."
      />
    </Card>
  );
}
