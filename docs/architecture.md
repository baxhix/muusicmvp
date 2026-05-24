# Arquitetura — muusic platform

Documento de orientação pra novos devs. Não cobre cada arquivo —
descreve **fronteiras**, **convenções** e **por que** decisões foram
feitas. Se você precisar de detalhe de implementação, código + JSDoc
inline são fonte de verdade.

## Visão de alto nível

```
┌───────────────────┐         ┌───────────────────┐
│   muusic.live     │         │ admin.muusic.live │
│   (público)       │         │ (admin app)       │
│   Next.js App     │         │   Next.js App     │
│   :3000           │         │   :3001 → :3010   │
└─────────┬─────────┘         └─────────┬─────────┘
          │                              │
          │   COOKIE_DOMAIN=.muusic.live │
          │   compartilham sessão        │
          ▼                              ▼
    ┌─────────────────────────────────────────┐
    │   muusic backend (Node.js)              │
    │                                          │
    │   ┌──────────────┐  ┌────────────────┐   │
    │   │  web (REST)  │  │  socket (WS)   │   │
    │   │  Next API    │  │  Socket.IO     │   │
    │   │  routes      │  │  porta 3002    │   │
    │   └──────┬───────┘  └────────┬───────┘   │
    │          │                    │           │
    │          └─────────┬──────────┘           │
    │                    ▼                       │
    │   ┌─────────────────────────────────┐     │
    │   │  PostgreSQL 16 (Drizzle ORM)    │     │
    │   │  25 tabelas, 25+ indexes        │     │
    │   │  Pool: max 50, timeout 5s       │     │
    │   └─────────────────────────────────┘     │
    └─────────────────────────────────────────┘
```

## Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| Frontend | Next.js 14 App Router | SSR + Server Components, ecossistema |
| Tipos | TypeScript estrito | Zero `any`, refactor seguro |
| Backend REST | Next.js API Routes | Co-localizado com o web |
| Real-time | Socket.IO em processo separado | Isolamento — restart do web não derruba chat |
| Banco | PostgreSQL 16 + Drizzle ORM | Type-safe queries, migrations versionadas |
| Storage | Filesystem (Docker volume) | MVP — abstração em `src/server/storage/` pronta pra S3 |
| Email | Resend | Managed, simples, com retry+timeout wrapper |
| Mapas | Mapbox GL | Globo 3D + reverse geocoding |
| Analytics | PostHog | Self-host + client-side eventos |
| Deploy | Docker Compose + VPS + GHCR | Simples, auto-deploy via GitHub Actions |

## Estrutura de pastas

```
src/
├── app/                   # Next.js App Router
│   ├── api/               # API routes (REST)
│   │   ├── admin/         # Rotas privadas — exigem requireAdmin()
│   │   ├── auth/          # Login, OTP, sessão
│   │   ├── feed/          # CMS público do feed
│   │   └── ...
│   ├── auth/              # Páginas de login/verify
│   ├── app/               # App autenticado (feed, chat, perfil)
│   └── ...                # Marketing pages (/, /teste, /blog, ...)
│
├── components/            # Componentes React reutilizáveis
│   ├── app/               # Específicos da área autenticada
│   ├── ui/                # Design system (Button, Card, ...)
│   └── ...
│
├── server/                # Código que só roda no servidor
│   ├── api/               # Helpers de API (handleApiError, ...)
│   ├── auth/              # Session, tokens, requireAdmin/User
│   ├── db/                # Drizzle config, schema, migrations
│   ├── email/             # Resend + magicLink + retry
│   ├── feed/              # Queries + storage do feed
│   ├── materiais/         # Queries + storage do acervo
│   ├── realtime/          # Handlers Socket.IO + rate limit
│   ├── storage/           # Abstração de filesystem (futuro S3)
│   ├── env.ts             # Validação Zod das env vars
│   ├── log.ts             # Logger estruturado + Sentry hook
│   └── rateLimit.ts       # Token buckets HTTP
│
├── lib/                   # Helpers client-safe
│   └── ...
│
└── types/                 # Tipos compartilhados client+server
```

## Convenções

### 1. Camadas

```
HTTP route (app/api/*/route.ts)
    └─ chama → service (server/<feature>/queries.ts ou similar)
                └─ usa → db (Drizzle) + storage (filesystem)
```

- **Route handlers** ficam SKINNY — validação (Zod) + chamada de service + resposta.
- **Services** contêm regra de negócio. Idealmente puros (recebem deps).
- **Queries** (Drizzle) ficam isoladas em `*/queries.ts`.
- **Storage** (filesystem hoje, S3 amanhã) atrás de `src/server/storage/`.

### 2. Autenticação / autorização

- Sessão via **cookie httpOnly** assinado, escopo `.muusic.live`.
- Token de sessão = SHA-256 do raw armazenado no DB; raw vai pro cookie.
- Magic link + OTP de 6 dígitos (ambos consomem o mesmo token).
- **`requireUser()`** em rotas privadas, **`requireAdmin()`** em rotas admin.
- 100% das rotas `app/api/admin/*` usam `requireAdmin()`.

### 3. Validação de input

- **Zod** em todas as rotas que recebem body JSON.
- **FormData** valida manualmente (Zod não é natural pra multipart).
- Env vars: schema Zod em `server/env.ts` valida no boot.

### 4. Erros

- **`handleApiError(err, { scope, ctx })`** central converte qualquer erro num NextResponse JSON.
- Hierarquia: `ValidationError`, `Unauthorized`, `Forbidden`, `NotFound`, `Conflict`, `RateLimit`, `Upstream`.
- **Stack nunca vai pro cliente** — só `logger.error()` recebe.
- Catch-all → 500 `internal_error`.

### 5. Logging

- **`logger.error/warn/info/debug`** — único entry point.
- **`setErrorTransport()`** plug pra Sentry/Datadog (hoje só `console.error` + `docker logs`).
- Sem `console.*` direto no código novo.

### 6. Rate limiting

- **TokenBucket** in-memory em `src/server/realtime/rateLimit.ts`.
- Helpers HTTP em `src/server/rateLimit.ts`: `limitByIp(req, bucket, scope)`.
- Buckets pré-configurados: `magicLinkLimiter`, `verifyLimiter`, `uploadLimiter`, `writeLimiter`.
- **In-memory**: quando ir multi-instance, substituir por Redis-backed.

### 7. CORS + security headers

- `src/middleware.ts` aplica CORS com allowlist explícita (admin.muusic.live + localhost).
- `next.config.ts` aplica security headers globalmente: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- CSP em modo Report-Only — vide [csp-rollout.md] (quando criar).

### 8. Comments

- PT-BR é o idioma do projeto (decisão consciente — context Brasil).
- Códigos de erro / nomes técnicos em inglês.
- Comentários explicam **por quê**, não **o quê**.

## Decisões importantes

### Por que Drizzle e não Prisma?
Type-safety equivalente, sem code-gen, queries SQL-like legíveis,
sem pesar 200MB no node_modules.

### Por que Socket.IO em processo separado?
Restart do web (deploy) não derruba conexões de chat. Quando escalar,
processo socket vira N instâncias atrás de Redis adapter.

### Por que filesystem agora, não S3?
Custo zero, simples pra MVP. Abstração já está pronta em
`src/server/storage/` — swap = implementar S3 backend + trocar 1
linha no factory. Vide [storage-scale.md].

### Por que sem queue/workers?
Atualmente: emails, processamento de imagens, etc. são síncronos.
Aceitável até ~1k usuários ativos. Bottleneck claro pra ir além.
Roadmap: BullMQ + Redis.

### Por que sem testes (até pouco tempo)?
MVP velocity. Agora a base começou: `vitest` cobre validators
puros (MIME, rate limit, retry, regex anti-traversal, logger).
Próximo: integration tests com DB de teste (testcontainers).

## Como rodar

Vide [`README.md`](../README.md) raiz.

## Como contribuir

1. **TypeScript estrito** — zero `any`. Use `unknown` + narrow.
2. **Comentários `por que`** — leitor do código JÁ entende `o quê`.
3. **`logger.*` sempre**, nunca `console.*`.
4. **Zod em route handler** que recebe body JSON.
5. **`handleApiError`** em todos os `catch` de routes.
6. **Migrations** via `drizzle-kit generate` — nunca edite DB manualmente.
7. **Indexes em colunas filtradas** — schema tem 25+, mantenha o padrão.
8. **Type-check + build limpos** antes de commit (`npx tsc --noEmit` + `npm run build`).
9. **Testes pra validators / regex / business logic puro** — não obrigatório pra page handlers ainda.

## Onde estamos vs. onde queremos chegar

| Capacidade hoje | Próximo bloqueador |
|---|---|
| ~800 usuários ativos OK | Storage S3 + CDN |
| 1k+ Socket.IO em 1 processo | Redis adapter |
| Single VPS | Multi-instance + managed DB |
| Sem queue | BullMQ pra emails/processamento |
| Sem observability externa | Sentry via `setErrorTransport()` |

Detalhamento em `docs/scale-readiness.md` (a criar).
