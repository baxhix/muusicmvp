# muusic — plataforma de superfãs

Aplicação web Next.js + PostgreSQL + Socket.IO para conectar artistas
musicais aos seus superfãs (Brasil-first). Inclui o app público
(`muusic.live`) e o painel admin (`admin.muusic.live`).

## Requisitos

- Node.js 20+
- PostgreSQL 16+
- Docker + Docker Compose (opcional, recomendado)
- Conta Resend (envio de email)
- Token Mapbox (mapas)

## Setup local

```bash
# 1. Instalar dependências
npm install
cd admin && npm install && cd ..

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env e preencha: AUTH_SECRET, DATABASE_URL, RESEND_API_KEY, etc.

# 3. Subir o Postgres (via Docker)
docker compose up -d postgres

# 4. Rodar migrations + seed
npm run db:migrate
npm run db:seed

# 5. Iniciar o servidor de dev
npm run dev          # web (porta 3000)
npm run realtime:dev # socket (porta 3002) — outro terminal
cd admin && npm run dev  # admin (porta 3001) — outro terminal
```

Acesse:
- App público: http://localhost:3000
- Admin: http://localhost:3001

## Scripts

```bash
# Dev
npm run dev               # Next.js web (Turbopack)
npm run realtime:dev      # Socket.IO server (tsx watch)
npm run build             # Build de produção

# DB (Drizzle)
npm run db:generate       # Gera migration de mudanças no schema
npm run db:migrate        # Aplica migrations pendentes
npm run db:seed           # Popula seed data
npm run db:studio         # Drizzle Studio (UI do DB)

# Tests
npm test                  # Roda testes uma vez
npm run test:watch        # Modo watch
npm run test:coverage     # Relatório de cobertura

# Lint
npm run lint              # ESLint
```

## Arquitetura

Vide [`docs/architecture.md`](docs/architecture.md) — visão de
componentes, convenções e decisões importantes.

## Fluxo de autenticação

Magic link + OTP fallback de 6 dígitos. Sessão via cookie httpOnly
compartilhado entre subdomínios. Detalhes em
[`docs/auth-flow.md`](docs/auth-flow.md).

## CI/CD

GitHub Actions roda na branch `main`:
1. Type-check + build
2. Push de imagens Docker pro GHCR
3. SSH deploy na VPS (`docker compose pull && up -d`)

Detalhes em [`docs/CICD.md`](docs/CICD.md) e
[`docs/DEPLOY.md`](docs/DEPLOY.md).

## Estrutura

```
muusicMVP/
├── src/                  # Web app (Next.js) + servidor
│   ├── app/              # App Router (pages + API routes)
│   ├── components/       # React components
│   ├── server/           # Código server-only (DB, auth, storage)
│   ├── lib/              # Helpers client-safe
│   └── types/            # Tipos compartilhados
│
├── admin/                # Admin app (Next.js separado)
│   └── ...
│
├── docs/                 # Documentação
│   ├── architecture.md
│   ├── auth-flow.md
│   ├── CICD.md
│   └── DEPLOY.md
│
├── drizzle/              # Migrations geradas
└── docker-compose.yml
```

## Convenções de código

- **TypeScript estrito** — zero `any` no codebase.
- **Comentários em PT-BR**, decisão consciente. Códigos técnicos
  (erros, nomes de função) em inglês.
- **Comentários explicam `por que`** — código JÁ é o `o quê`.
- **Logger** (`@/server/log`) em vez de `console.*`.
- **Zod** em todas as rotas com body JSON.
- **`handleApiError`** central em todos os `catch` de routes.
- **Type-check + build limpos** antes de commit:
  ```bash
  npx tsc --noEmit && npm run build && npm test
  ```

## Saúde da aplicação

`GET /api/health` retorna 200 quando tudo OK, 503 se algo está mal.
Inclui stats do pool de DB. Use em healthcheck do Docker e probes
de load balancer.

## Para escalar

- Hoje suporta confortavelmente **~800 usuários ativos** em VPS único.
- Plano de escala detalhado em
  [`docs/scale-readiness.md`](docs/scale-readiness.md) (a criar).
  Resumo: S3+CDN, Redis adapter pro Socket.IO, managed Postgres.

## Licença

Proprietário. © muusic.live
