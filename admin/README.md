# Fanverse Admin

Painel administrativo standalone da plataforma Fanverse.

> **Status atual**: Fundação (Fase 1) entregue — design system, layout, theme dark/light, mocks, service layer e rota Dashboard funcional. As outras 5 seções estão como placeholders explicando o escopo planejado.

## Stack

Espelha exatamente a stack do `fanverse-web`:

- **Next.js 15** (App Router + Turbopack)
- **React 19**
- **TypeScript 5**
- **CSS Modules** (sem Tailwind, sem shadcn) — tokens em CSS vars
- **Inter** via `next/font/google`
- Ícones: SVG inline (zero deps)
- Charts: SVG escrito à mão (zero deps)

Sem deps adicionais. O `package.json` contém apenas o que o `fanverse-web` já usa.

## Como rodar

```bash
cd fanverse-admin
npm install
npm run dev
# http://localhost:3001
```

> A porta padrão é **3001** (definida no `package.json`) para coexistir com o `fanverse-web` rodando em 3000.

## Estrutura

```
src/
├─ app/
│  ├─ layout.tsx              # ThemeProvider + ToastProvider + bootstrap script
│  ├─ globals.css             # Tokens (light/dark), reset, keyframes
│  ├─ page.tsx                # Redirect para /dashboard
│  └─ (shell)/                # Route group com sidebar + topbar
│     ├─ layout.tsx
│     ├─ dashboard/           # ✅ Funcional (KPIs, charts, atividade)
│     ├─ feed/                # 🟡 Placeholder
│     ├─ users/               # 🟡 Placeholder
│     ├─ moderation/          # 🟡 Placeholder
│     ├─ superfans/           # 🟡 Placeholder
│     └─ settings/            # 🟡 Placeholder
│
├─ components/
│  ├─ ui/                     # Primitivos reutilizáveis (Button, Input, Card, Table, etc.)
│  ├─ layout/                 # Sidebar, TopBar, ThemeToggle
│  └─ icons/                  # Conjunto unificado de SVG inline
│
├─ data/
│  └─ mock/                   # Dados mock coerentes em pt-BR (Brasil)
│     ├─ users.ts
│     ├─ posts.ts
│     ├─ reports.ts
│     ├─ superfans.ts
│     ├─ activity.ts
│     └─ metrics.ts
│
├─ services/                  # Camada de acesso a dados — usada pelas páginas
│  ├─ api.ts                  # ⭐ ÚNICO PONTO DE TROCA mock → HTTP
│  ├─ users.ts
│  ├─ posts.ts
│  ├─ reports.ts
│  ├─ superfans.ts
│  └─ metrics.ts
│
├─ lib/
│  ├─ theme.tsx               # ThemeProvider (light/dark/system) + bootstrap script
│  ├─ utils.ts                # cn(), uid(), clamp(), pluralize()
│  └─ format.ts               # Formatadores pt-BR (BRL, datas, relativos)
│
├─ types/
│  └─ index.ts                # Tipos de domínio (User, Post, Report, Superfan, etc.)
│
└─ hooks/                     # Hooks compartilhados (vazia por ora)
```

## Design system

**Inspiração**: Vercel Dashboard. Denso, preciso, microinterações sutis.

**Tokens** (em `globals.css`):

- Border radius base: **6px** em inputs, botões, badges (`--r-sm`)
- Tipografia: Inter, escalonada por size variants
- Espaçamento: grid de 4px (`--s-1` a `--s-16`)
- Cores semânticas: `--brand`, `--info`, `--success`, `--warning`, `--danger`, `--neutral`
- Sombras: `--shadow-xs` → `--shadow-pop`
- Motion: `--ease-out`, durações `--dur-fast/base/slow`

**Tema** (`data-theme="light|dark"` no `<html>`):

- Persistência via `localStorage`
- Suporta preferência `system` (segue OS)
- Bootstrap script no `<head>` evita FOUC

## Camada de dados — como integrar a API real depois

Toda página chama uma função de service (`usersService.list()`, `metricsService.kpis()`, etc.). Os services chamam `api.get/post/patch/delete` em [`src/services/api.ts`](src/services/api.ts).

Hoje o `api` aponta para um **mockDriver** que serve `src/data/mock/*`. Para trocar por HTTP real:

### Opção 1 — auto-detectar via env

```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL=https://api.fanverse.app
```

Sem nenhuma mudança de código, o `api.ts` detecta `BASE_URL` e troca para o `httpDriver`.

### Opção 2 — forçar driver

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.fanverse.app
NEXT_PUBLIC_API_DRIVER=http   # ou "mock" para forçar mocks em produção
```

### Opção 3 — limpar mocks de vez

Quando o backend estiver pronto e estável:

1. Delete `src/data/mock/`
2. Em `src/services/api.ts`, remova `mockDriver`, `mockRoutes` e `mockCall`
3. Mantenha apenas `httpDriver`

Os imports nos services continuam idênticos — `services/users.ts` não muda uma linha.

### Auth

Quando precisar enviar tokens, edite **apenas** o bloco `headers` em `httpCall()` dentro de `api.ts`. Não toque nos services individuais.

## Portabilidade

Este projeto é completamente independente do `fanverse-web`. Para reaproveitar em outro projeto:

1. Copie a pasta `fanverse-admin/` inteira
2. `npm install`
3. Pronto

Não há deps simbólicas, paths relativos cruzados ou shared modules entre os dois projetos.

## Próximas fases

Quando o usuário aprovar, a Fase 2 implementa as 5 páginas restantes (Feed, Usuários, Moderação, Superfãs, Configurações) usando os primitivos já prontos.
