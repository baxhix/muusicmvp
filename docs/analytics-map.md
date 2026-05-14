# Analytics — mapa de eventos

> Este documento é a referência única para o sistema de eventos da plataforma.
> Toda chamada `track('…')` no código se origina aqui. Editou um evento? Atualize ambos: `src/lib/analytics/events.ts` E este arquivo.

---

## Stack

| Camada                    | Ferramenta                              | Papel                                                                      |
| ------------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| Product Analytics         | **PostHog**                             | Repositório principal — recebe TODOS os eventos. Funnels, cohorts, retenção, session replays. |
| Exec dashboard            | **Google Analytics 4** (gtag.js)        | Recebe APENAS os eventos marcados `ga4: true` no registry. Visão executiva. |
| Pixels de marketing       | Meta Pixel, Microsoft Clarity, etc.     | Carregados pelo `TrackingTags` server component, configurados em `/admin/settings → Tags`. |

---

## Arquitetura

```
src/lib/analytics/
├── events.ts             # Registro tipado: nome → payload + metadados
├── client.ts             # Wrappers PostHog + GA4 (no-op safe)
├── index.ts              # API pública: track() / identify() / reset() / page()
└── AnalyticsProvider.tsx # Auto-events (page_view, session, scroll_depth, …)
                          # + identify() automático no login
```

**Regra de ouro:** nenhum código fora desta pasta deve chamar `posthog.*` ou `gtag(...)` direto. Sempre passe por:

```ts
import { track } from '@/lib/analytics';
track('feed_post_liked', { post_id, creator_name });
```

O TypeScript reclama na hora se você inventar um nome de evento ou esquecer uma propriedade obrigatória.

---

## Convenções

### Nomenclatura

- `snake_case`
- `area_action`                — quando a ação é da área inteira (`session_started`, `page_view`)
- `area_entity_action`         — quando uma entidade owns the action (`feed_post_liked`, `comment_reaction_toggled`)
- `entity_action`              — quando a entidade é inequívoca (`comment_created`, `track_liked`)

Evite nomes genéricos (`click`, `submit`, `view`). Cada evento deve responder à pergunta "o que aconteceu, em qual contexto?".

### Versionamento

- Nunca renomeie um evento em produção — análises quebram.
- Para mudanças incompatíveis, crie `feed_post_liked_v2` e deprecate o antigo em uma única release.
- Para mudanças aditivas (novas propriedades opcionais), apenas extenda o tipo no registry.

### Propriedades

Cada evento recebe automaticamente as propriedades globais (não precisa passar):

| Propriedade        | Origem                                                       |
| ------------------ | ------------------------------------------------------------ |
| `session_id`       | UUID por aba/sessão, gerado no boot do AnalyticsProvider     |
| `app_version`      | `process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'`               |
| `is_authenticated` | Atualizado quando `identify()` / `reset()` são chamados      |
| `pathname`         | Atualizado a cada `usePathname()` change                     |
| `$current_url`     | Injetado pelo PostHog automaticamente                        |

Propriedades específicas do evento ficam declaradas no `EventPayloadMap` em `events.ts`.

### Importância

- **critical** — perda destes inviabiliza análises de produto (login, primeira interação, conversão de assinatura).
- **high** — eventos de engajamento direto (curtir, comentar, mensagem enviada).
- **medium** — sinais úteis para entender o uso (abrir tela, navegação).
- **low** — pulso (scroll_depth, time_on_screen).

---

## Inventário completo de eventos

### 🔐 auth

| Evento                  | Importância | GA4 | Trigger                                                  |
| ----------------------- | ----------- | --- | -------------------------------------------------------- |
| `auth_login_requested`  | high        |     | Usuário pediu link mágico ou iniciou OAuth.              |
| `auth_login_success`    | critical    | ✓   | Sessão criada com sucesso (cookie emitido).              |
| `auth_login_failed`     | high        |     | Tentativa de login rejeitada (4xx do endpoint).          |
| `auth_logout`           | medium      |     | Usuário encerrou a sessão manualmente.                   |

### 🕒 session (auto-fired)

| Evento             | Importância | GA4 | Trigger                                                  |
| ------------------ | ----------- | --- | -------------------------------------------------------- |
| `session_started`  | high        | ✓   | AnalyticsProvider monta (primeira interação no app).     |
| `session_ended`    | high        | ✓   | `visibilitychange=hidden` ou `pagehide`.                 |

### 🧭 navigation (auto-fired)

| Evento                 | Importância | GA4 | Trigger                                                  |
| ---------------------- | ----------- | --- | -------------------------------------------------------- |
| `page_view`            | high        | ✓   | `usePathname()` muda OU primeiro mount.                  |
| `screen_view`          | medium      |     | Tab/painel ativo muda em `/app` ou `/admin`.             |
| `navigation_changed`   | low         |     | Transição entre dois pathnames.                          |

### 🚀 onboarding

| Evento                         | Importância | GA4 | Trigger                                                  |
| ------------------------------ | ----------- | --- | -------------------------------------------------------- |
| `onboarding_started`           | high        | ✓   | Usuário recém-criado entra no fluxo de onboarding.       |
| `onboarding_step_completed`    | medium      |     | CTA do step disparado.                                   |
| `onboarding_completed`         | critical    | ✓   | Última tela do fluxo concluída.                          |
| `first_engagement`             | critical    | ✓   | Primeira interação real (curtir/comentar/dar play).      |

### 📰 feed

| Evento                          | Importância | GA4 | Trigger                                                  |
| ------------------------------- | ----------- | --- | -------------------------------------------------------- |
| `feed_loaded`                   | medium      |     | FeedPanel monta + admin posts hidratados.                |
| `feed_post_viewed`              | medium      |     | Post entrou na viewport por >1s (IntersectionObserver).  |
| `feed_post_liked`               | high        | ✓   | Botão de like alternado para liked=true.                 |
| `feed_post_unliked`             | low         |     | Botão de like alternado para liked=false.                |
| `feed_post_carousel_advanced`   | medium      |     | Chevron clicado ou dot de página selecionado.            |
| `feed_post_video_played`        | medium      |     | Botão de play do MediaPost.                              |
| `feed_post_video_muted`         | low         |     | Botão de áudio do MediaPost.                             |
| `feed_post_shared`              | high        | ✓   | Ação de share / cópia de link.                           |

### 💬 comment

| Evento                       | Importância | GA4 | Trigger                                                  |
| ---------------------------- | ----------- | --- | -------------------------------------------------------- |
| `comment_created`            | critical    | ✓   | POST `/api/feed/posts/:postKey/comments` aceito.         |
| `comment_reply_created`      | high        | ✓   | POST `/api/feed/comments/:id/replies` aceito.            |
| `comment_reaction_toggled`   | high        |     | POST `/api/feed/comments/:id/reactions` retorna sucesso. |
| `comment_deleted`            | medium      |     | DELETE `/api/feed/comments/:id` aceito.                  |
| `comment_replies_expanded`   | low         |     | Botão "Ver respostas" clicado.                           |

### 💌 chat

| Evento                          | Importância | GA4 | Trigger                                                  |
| ------------------------------- | ----------- | --- | -------------------------------------------------------- |
| `chat_conversation_opened`      | medium      |     | LiveChatPanel hidrata uma conversa.                      |
| `chat_message_sent`             | critical    | ✓   | `chat:send` emite com ack ok.                            |
| `chat_message_reacted`          | medium      |     | `chat:react` emite com ack ok.                           |
| `chat_mention_used`             | high        |     | `chat:send` com `mention_count > 0`.                     |
| `chat_group_created`            | high        | ✓   | POST `/api/conversations` type=group aceito.             |
| `chat_group_member_added`       | medium      |     | POST `/api/conversations/:id/members` aceito.            |
| `chat_group_member_removed`     | medium      |     | DELETE `/api/conversations/:id/members/:userId` aceito.  |
| `chat_group_left`               | medium      |     | Mesmo endpoint, com userId = self.                       |
| `chat_conversation_reported`    | high        |     | POST `/api/reports` aceito.                              |

### 🎵 player

| Evento                   | Importância | GA4 | Trigger                                                  |
| ------------------------ | ----------- | --- | -------------------------------------------------------- |
| `player_track_started`   | critical    | ✓   | Track muda em useListeningTracker.                       |
| `player_track_completed` | high        | ✓   | Track anterior terminou (próxima começa).                |
| `player_track_paused`    | low         |     | `isPaused` flipa para true.                              |
| `player_track_resumed`   | low         |     | `isPaused` flipa para false.                             |
| `player_track_skipped`   | medium      |     | Skip explícito.                                          |
| `track_liked`            | high        | ✓   | POST `/api/me/tracks/:id/like` aceito.                   |
| `track_unliked`          | low         |     | DELETE no mesmo endpoint.                                |

### 👤 profile

| Evento             | Importância | GA4 | Trigger                                                  |
| ------------------ | ----------- | --- | -------------------------------------------------------- |
| `profile_viewed`   | medium      |     | Painel de perfil aberto.                                 |
| `profile_edited`   | medium      |     | PATCH `/api/me/profile` aceito.                          |
| `avatar_uploaded`  | medium      |     | POST `/api/me/avatar` aceito.                            |
| `avatar_removed`   | low         |     | DELETE `/api/me/avatar` aceito.                          |

### 🔎 search

| Evento                   | Importância | GA4 | Trigger                                                  |
| ------------------------ | ----------- | --- | -------------------------------------------------------- |
| `search_performed`       | medium      |     | Submit do input de busca (debounce 350ms).               |
| `search_result_clicked`  | high        |     | Item da lista de resultados ativado.                     |

### 🤝 social

| Evento               | Importância | GA4 | Trigger                                                  |
| -------------------- | ----------- | --- | -------------------------------------------------------- |
| `creator_followed`   | high        | ✓   | CTA "Seguir" ativado.                                    |
| `creator_unfollowed` | low         |     | CTA "Seguindo" desfeito.                                 |
| `content_shared`     | high        | ✓   | `navigator.share()` ou copy-link.                        |
| `invite_sent`        | high        | ✓   | Fluxo de convite concluído.                              |

### 🔔 notification

| Evento                    | Importância | GA4 | Trigger                                                  |
| ------------------------- | ----------- | --- | -------------------------------------------------------- |
| `notification_received`   | medium      |     | NotificationBell recebe novo item (socket/poll).         |
| `notification_opened`     | high        |     | Item da bell clicado.                                    |
| `notification_dismissed`  | low         |     | Ação de dismiss / swipe.                                 |
| `notifications_all_read`  | low         |     | CTA "Marcar todas".                                      |

### 📊 engagement (auto-fired)

| Evento            | Importância | GA4 | Trigger                                                  |
| ----------------- | ----------- | --- | -------------------------------------------------------- |
| `scroll_depth`    | low         |     | Crossou 25/50/75/100% do scroll. Uma vez por pathname.   |
| `time_on_screen`  | low         |     | AnalyticsProvider mede tempo entre pathname changes.     |
| `button_clicked`  | low         |     | Click em qualquer elemento com `data-analytics-id`.      |

### 🛠️ admin

| Evento                          | Importância | GA4 | Trigger                                                  |
| ------------------------------- | ----------- | --- | -------------------------------------------------------- |
| `admin_feed_post_created`       | high        |     | POST `/api/admin/feed` retorna 201.                      |
| `admin_feed_post_updated`       | medium      |     | PATCH `/api/admin/feed/:id` retorna 200.                 |
| `admin_feed_post_published`     | high        |     | POST `/api/admin/feed/:id/publish`.                      |
| `admin_feed_post_deleted`       | medium      |     | DELETE `/api/admin/feed/:id`.                            |
| `admin_site_tag_updated`        | medium      |     | PATCH `/api/admin/site-tags/:kind`.                      |

### 💳 monetization (futuro)

| Evento                            | Importância | GA4 | Trigger                                                  |
| --------------------------------- | ----------- | --- | -------------------------------------------------------- |
| `subscription_checkout_started`   | critical    | ✓   | Botão "Assinar" no plano selecionado.                    |
| `subscription_started`            | critical    | ✓   | Webhook do gateway recebido (pagamento confirmado).      |
| `subscription_renewed`            | high        | ✓   | Webhook recorrente.                                      |
| `subscription_canceled`           | high        | ✓   | Webhook ou ação direta.                                  |
| `purchase_completed`              | critical    | ✓   | Webhook do gateway para compra avulsa.                   |

---

## Uso típico

### Disparar um evento

```ts
import { track } from '@/lib/analytics';

// O TS valida nome + propriedades em compile time.
track('feed_post_liked', {
  post_id: 'abc-123',
  post_key: 'feed:abc-123',
  creator_name: 'Central Ana Castela',
});
```

### Identificar o usuário no login

Feito automaticamente pelo `AnalyticsProvider` no momento em que `useAuth().user` se torna não-nulo. Não precisa chamar manualmente.

Propriedades persistentes enviadas:

```ts
identify(user.id, {
  email: user.email,
  name: user.name,
  role: user.role,
  city: user.city,
  country: user.country,
});
```

### Limpar a identificação no logout

Também automático no `AnalyticsProvider` — `reset()` é chamado quando `user` volta a `null`.

### Eventos de UI genéricos

Para registrar cliques em CTAs sem espalhar `track()` no código:

```tsx
<Button data-analytics-id="cta_play_first_track">Tocar</Button>
```

O `AnalyticsProvider` ouve cliques no document e dispara `button_clicked` quando o elemento (ou um ancestral) tem `data-analytics-id`.

### Deduplicação

`track()` aceita um terceiro argumento opcional:

```ts
track('feed_post_viewed', { post_id }, { dedupeKey: post_id, dedupeMs: 30_000 });
```

O mesmo `(evento, dedupeKey)` disparado de novo dentro do `dedupeMs` (default 1.5s) é silenciosamente descartado.

---

## Configuração

### Variáveis de ambiente

| Variável                          | Default                       | Descrição                                                |
| --------------------------------- | ----------------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY`         | (vazio)                       | Project key. Sobrescrita pela aba `/admin/settings → Tags`. |
| `NEXT_PUBLIC_POSTHOG_HOST`        | `https://us.i.posthog.com`    | Host da instância PostHog (US ou EU).                    |
| `NEXT_PUBLIC_APP_VERSION`         | `dev`                         | Stamp anexado a cada evento como propriedade global.     |
| `NEXT_PUBLIC_GA_ID`               | (vazio)                       | Fallback do GA4 se a tag de DB não estiver configurada.  |

### Admin (DB-driven)

`/admin/settings → Tags` permite editar via UI:

- **PostHog**: project key (override do env, leitura cacheada por 60s).
- **GA4**, **GTM**, **Meta Pixel**, **MS Clarity**, **TikTok Pixel**, **Hotjar**: pixels injetados pelo `TrackingTags` server component.

Cada tag tem toggle ativo/inativo + campo de ID. Pausar uma tag não apaga o valor — basta destrancar para reativar.

---

## Adicionando um evento novo

1. Adicione o nome ao `EventPayloadMap` em `src/lib/analytics/events.ts` com a tipagem do payload.
2. Adicione o `EVENT_META` correspondente (category, importance, description, trigger, ga4?).
3. Chame `track('seu_evento_novo', { … })` no call site.
4. Documente nesta tabela (`docs/analytics-map.md`).
5. Crie o dashboard / funil no PostHog.

**Não tem outro passo.** A camada de tracking infere tudo a partir do registry.

---

## Análises preparadas

A taxonomia foi desenhada para destravar:

- **Funnel de ativação**: `session_started → page_view (/app) → first_engagement → onboarding_completed`
- **Retenção D1/D7/D30**: PostHog cohorts via `auth_login_success`
- **DAU/MAU**: cohorts diários/mensais sobre `session_started` autenticado
- **Engagement por feature**: filtros por `category` (`feed`, `chat`, `player`)
- **Top creators**: groupby `creator_name` em `feed_post_liked` + `comment_created`
- **Análise por conteúdo**: groupby `post_id` em `feed_post_viewed` + `feed_post_liked` + `comment_created`
- **Superfãs**: usuários com `chat_message_sent` + `track_liked` + `comment_created` no mesmo período
- **LTV / Churn** (quando monetização ligar): `subscription_started` → `subscription_renewed` ou `subscription_canceled`

---

## Convenções de segurança

- Inputs sensíveis (campos com `data-private`) são mascarados no PostHog session recording.
- Nenhum evento carrega `email` ou `body` completos como propriedade — apenas `body_length`, `mention_count`, etc.
- O `identify()` envia traits PII (email, name, city) para PostHog porque é o lugar certo desses dados; eles **não** vão para o GA4.
