/**
 * Token bucket **distribuído via Redis** — stub pronto pra ativar
 * na migração AWS (ElastiCache / Redis OSS).
 *
 * Por que existe agora: a versão in-memory (`./rateLimit.ts`) tem
 * 2 problemas conhecidos quando a app virar multi-instância:
 *
 *   1. **Rate limit furado N× pelo número de instâncias.** Cada
 *      worker tem seu próprio Map, então um atacante distribuindo
 *      requests entre N web containers consegue N× o limite
 *      permitido. Crítico em `auth/request` (magic-link spam) e
 *      `auth/verify` (brute-force OTP).
 *
 *   2. **Estado some no restart.** Deploy = todo bucket zerado.
 *      Atacante pode esperar o deploy janelar e disparar burst.
 *
 * A solução padrão é Redis com script Lua atômico — leitura,
 * refill, deduct e write num único RTT sem race condition. Cada
 * worker bate no mesmo Redis e vê o mesmo estado.
 *
 * Checklist pra ativar (na migração AWS):
 *
 *   1. `npm install ioredis`
 *      (ioredis tem suporte nativo a Cluster mode do ElastiCache;
 *      o `redis` v4+ também serve mas exige adapter de cluster
 *      manual.)
 *
 *   2. Provisionar ElastiCache Redis (t4g.micro já basta pro
 *      MVP — single-node, sem cluster). Recomendado: TLS habilitado
 *      + AUTH token via Secrets Manager.
 *
 *   3. Preencher os `TODO:` abaixo. O script Lua já está pronto
 *      (constante `TOKEN_BUCKET_LUA`) — só falta o client + a
 *      chamada `eval`.
 *
 *   4. Adicionar ao `src/server/env.ts`:
 *        REDIS_URL: z.string().url(),
 *        RATE_LIMIT_BACKEND: z.enum(['memory', 'redis']).default('memory'),
 *
 *   5. Substituir os 9 `new TokenBucket(...)` espalhados (lista em
 *      `git grep "new TokenBucket"`) por uma factory:
 *        export const magicLinkLimiter = createTokenBucket('auth:magic', 5, 0.083);
 *      A factory respeita `RATE_LIMIT_BACKEND`.
 *
 *   6. Deploy gradual: subir uma instância nova com RATE_LIMIT_BACKEND=redis
 *      lado a lado com as antigas (memory). Validar métricas. Depois
 *      flipar todas.
 *
 * Compatibilidade da interface — atenção: o `consume()` aqui é
 * **async** (retorna `Promise<boolean>`), enquanto o in-memory é
 * **sync** (retorna `boolean`). É a única quebra real do swap:
 * call sites vão precisar de `await`.
 *
 * Lista dos call sites pra adicionar await (≈9 lugares):
 *   git grep -n '\.consume('
 *
 * Em routes Next.js (já são async functions), só prepend `await`.
 * Em handlers Socket.IO síncronos, virar callback async — IO já
 * é async por natureza, sem impacto observável de latência.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Script Lua atômico — refill + deduct numa única operação Redis.
 *
 * Args:
 *   KEYS[1] = bucket key (ex: 'rl:auth:magic:1.2.3.4')
 *   ARGV[1] = capacity (max tokens)
 *   ARGV[2] = refill rate (tokens/s)
 *   ARGV[3] = cost (tokens a consumir)
 *   ARGV[4] = now (ms desde epoch)
 *
 * Retorna: 1 se permitido (decrementou), 0 se rate-limited.
 *
 * Storage no Redis: HASH com fields {tokens, last_refill}. TTL
 * automático de 5 min (renovado em cada touch — buckets ociosos
 * são GC pelo próprio Redis sem precisar evictStale).
 */
export const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now

local elapsed = (now - last_refill) / 1000
tokens = math.min(capacity, tokens + elapsed * refill_rate)

if tokens < cost then
  redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
  redis.call('PEXPIRE', key, 300000)
  return 0
end

tokens = tokens - cost
redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
redis.call('PEXPIRE', key, 300000)
return 1
`;

export interface RedisTokenBucketConfig {
  /** Namespace prefix da key (ex: 'auth:magic'). Misturado com
   *  o `key` do `consume()` pra formar a Redis key final. */
  namespace: string;
  capacity: number;
  refillRate: number;
}

export class RedisTokenBucket {
  // private readonly redis: Redis;
  // private scriptSha?: string;

  constructor(
    private readonly config: RedisTokenBucketConfig,
    // redis: Redis,
  ) {
    /* TODO(aws-migration):
     * this.redis = redis;
     * // Pre-load script com SCRIPT LOAD pra cachear o SHA e
     * // usar EVALSHA (1 RTT em vez de 2 quando o script já está
     * // em cache).
     * this.redis.script('LOAD', TOKEN_BUCKET_LUA).then((sha) => {
     *   this.scriptSha = sha as string;
     * });
     */
    throw new Error(
      'redisTokenBucket.ts: stub não implementado. Veja header do arquivo pra checklist de ativação.',
    );
  }

  /** Mesma semântica do `TokenBucket` in-memory: true = permitido,
   *  false = rate-limited. */
  async consume(key: string, cost = 1): Promise<boolean> {
    /* TODO(aws-migration):
     * const fullKey = `rl:${this.config.namespace}:${key}`;
     * const args = [
     *   this.config.capacity.toString(),
     *   this.config.refillRate.toString(),
     *   cost.toString(),
     *   Date.now().toString(),
     * ];
     * const result = this.scriptSha
     *   ? await this.redis.evalsha(this.scriptSha, 1, fullKey, ...args)
     *   : await this.redis.eval(TOKEN_BUCKET_LUA, 1, fullKey, ...args);
     * return result === 1;
     */
    throw new Error('RedisTokenBucket.consume: não implementado');
  }

  // Sem `evictStale` aqui — o PEXPIRE no script Lua já cuida disso
  // de forma automática e melhor distribuída (sem precisar de cron).
}
