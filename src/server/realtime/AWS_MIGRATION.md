# Migração Realtime → AWS multi-instância

Este documento existe pra deixar **explícito** o que o dev backend
precisa fazer no Socket.IO quando a infra virar multi-container
(ECS/EKS). Tudo aqui é stub-driven: a interface já está limpa, o
trabalho é plugar Redis nos pontos certos.

## TL;DR — 3 trocas, ~1 dia de trabalho

1. **Socket.IO Redis adapter** — broadcast cruza entre instâncias
2. **Sticky sessions no ALB** — long-polling do socket.io precisa
3. **Presence + rate-limit em Redis** (stubs já no repo)

## 1. Socket.IO Redis adapter

Hoje (single-instance): `io.emit('presence:batch', ...)` atinge
**todos** os clients porque todos estão no mesmo processo.

Multi-instance sem adapter: `io.emit` só atinge os clients
conectados **naquele container**. Cliente A no container 1 não
vê eventos do cliente B no container 2. **Quebra silenciosa** —
sem erro, só usuários parando de receber updates.

### Como ativar

```bash
npm install @socket.io/redis-adapter ioredis
```

Em `src/server/realtime/server.ts`, após `new Server(httpServer)`:

```ts
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

const pub = new Redis(process.env.REDIS_URL!);
const sub = pub.duplicate(); // mesma conexão, modo pub/sub
io.adapter(createAdapter(pub, sub));
```

ElastiCache: 1 cluster Redis, modo cluster=disabled (single node)
basta pra MVP. Cluster mode habilitado precisa de uns ajustes
extras no adapter (ver docs do `@socket.io/redis-adapter`).

## 2. Sticky sessions no ALB

Socket.IO faz **upgrade** de HTTP polling → WebSocket. O handshake
inicial é HTTP (várias requests com `?sid=...`), e o ALB precisa
mandar todas essas requests pro **mesmo container** — senão o
handshake falha em loop.

Em Terraform / CloudFormation:

```hcl
resource "aws_lb_target_group" "socket" {
  # ...
  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400  # 1 dia
    enabled         = true
  }
}
```

Sem stickiness: 30–50% dos handshakes falham e o cliente cai em
polling de fallback (custoso). É detectável só por métricas
(handshake_errors_count), não por logs óbvios.

## 3. Presence distribuída

Hoje (`handlers/presence.ts`): `const onlineCount = new Map(...)`
in-memory.

Multi-instance: cada container vê só seus próprios usuários online.
O `isOnline(userId)` chamado de um container que não tem o user
conectado retorna `false` **mesmo se o user estiver online noutro**.

### Estratégia: Redis SET por presença

```ts
// online: SADD presence:online <userId>; EXPIRE presence:online 60
// offline: SREM presence:online <userId>
// query: SISMEMBER presence:online <userId>
```

Cada container faz HEARTBEAT a cada 30s tocando o EXPIRE. Container
crash = entry expira sozinho em 60s. Sem GC manual.

O **batching** do `presence:batch` continua local (cada container
batcha as próprias conexões), mas o `io.emit` viaja pelo adapter
Redis pros outros containers, que fazem fan-out pros próprios clients.

### Onde mexer

`src/server/realtime/handlers/presence.ts`:
- Substituir `onlineCount` Map por chamadas async ao Redis
- `isOnline()` vira async (call sites precisam `await`)
- `markOnline()` / `markOffline()` viram SADD/SREM
- Heartbeat já existe (30s), só passa a tocar EXPIRE do Redis

## 4. Rate limit distribuído

Stub completo em `./redisTokenBucket.ts` — Lua script atômico,
PEXPIRE automático, mesma assinatura (exceto sync→async).

## 5. Cron jobs

Hoje: `cron:anonymize` roda como script standalone (manual ou
systemd). Em AWS:

- **EventBridge + Lambda** (recomendado) — agendamento managed,
  sem precisar manter container vivo só pra cron
- ou **ECS Scheduled Tasks** — reusa o mesmo Docker image, dispara
  com schedule cron

Não precisa mudar código — só infra. O script atual
(`src/server/cron/anonymizeDeletedUsers.ts`) já é idempotente e
sem state local.

## 6. Connection pool Postgres

Hoje: pool `max: 50` por processo. Multi-container = 50 × N
conexões. RDS Postgres default permite 100 — vai estourar com 3
containers.

**Solução: RDS Proxy** entre app e RDS. Multiplexa conexões
fisicamente; app vê 50 conn lógicas, RDS vê 10 conn físicas. Zero
mudança de código, só endpoint no `DATABASE_URL`.

Alternativa local: PgBouncer no ECS, mesma ideia mas self-managed.

## Ordem recomendada de execução pelo dev

1. Provisionar ElastiCache + RDS Proxy (1h infra)
2. Aplicar `scripts/pg_trgm_indexes.sql` no RDS após o restore
   do dump (`psql $RDS_URL -f scripts/pg_trgm_indexes.sql`).
   No RDS master user tem CREATE EXTENSION nativo. (15min)
3. Plugar Redis adapter no Socket.IO + sticky sessions (2h)
4. Migrar rate-limit pro `RedisTokenBucket` (2h — 9 call sites + await)
5. Migrar presence pro Redis SET (2h)
6. Deploy gradual — 1 instância nova ao lado das antigas, validar
   métricas, depois flipar todas (1h)
7. EventBridge pro cron (30min)

**Total estimado: 1 dia de trabalho** — caso o repo siga com os
stubs prontos. Sem os stubs, o mesmo trabalho leva 3-4 dias
(escrever do zero, debugar interface, validar atomicidade do
rate-limit, etc.).
