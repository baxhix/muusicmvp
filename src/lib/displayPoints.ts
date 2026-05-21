/**
 * Cache em memória dos valores de Fanpoints por ActivityKind,
 * lido do endpoint público /api/fanpoints/display-rules.
 *
 * Por que existe: antes, `src/lib/rewards.ts` tinha um
 * REWARD_POINTS hardcoded que se PROPUNHA a espelhar o servidor.
 * Quando subimos a tabela `fanpoint_rules` editável pelo admin
 * (commit feat(fanpoints) anterior), o cliente continuou cravado
 * nos valores estáticos — toast e optimistic update divergiam do
 * crédito real do servidor sempre que o admin mexesse num valor.
 *
 * Estratégia: SOR (single source of resolution): toda chamada a
 * `getDisplayPoints(rule)` consulta este cache; o cache se
 * popula em segundo plano via fetch ao primeiro acesso e
 * revalida a cada 60s (mesma janela do cache server-side em
 * recordActivity, mantém os dois lados em paridade).
 *
 * Fallback resiliente: enquanto o fetch inicial não resolve, ou
 * se a rede falhar, devolve os valores do REWARD_POINTS const
 * (que ainda existe como spec inicial). Pior caso: toast usa o
 * valor padrão por uma fração de segundo até o cache aquecer.
 */

import { api } from './api/client';

/** Mesma união do servidor (src/server/activities/queries.ts). */
type ActivityKind =
  | 'stream'
  | 'login'
  | 'chat_started'
  | 'post_liked'
  | 'comment_posted'
  | 'post_shared'
  | 'three_streams';

/** Mapeia o "rule" do helper awardPoints (api do cliente, mais
 *  curta) pra `ActivityKind` (api do servidor, fonte de verdade). */
const RULE_TO_KIND: Record<string, ActivityKind> = {
  like: 'post_liked',
  comment: 'comment_posted',
  send: 'post_shared',
  chat_started: 'chat_started',
  three_streams: 'three_streams',
};

/** Fallback usado enquanto o cache não terminou de aquecer. Mantém
 *  o app funcional (toast aparece com valores razoáveis) mesmo em
 *  cold start. Os números abaixo devem refletir o seed inicial em
 *  drizzle/0021_*.sql. Quando o admin muda um valor, o cache pega
 *  no próximo refresh (até 60s); o fallback só serve no boot. */
const FALLBACK: Record<ActivityKind, number> = {
  stream: 0,
  login: 50,
  chat_started: 3,
  post_liked: 5,
  comment_posted: 10,
  post_shared: 15,
  three_streams: 10,
};

const CACHE_TTL_MS = 60_000;

let cache: Record<ActivityKind, number> | null = null;
let cacheExpiry = 0;
let inflight: Promise<void> | null = null;

async function refresh(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await api.get<{ rules: Record<ActivityKind, number> }>(
        '/api/fanpoints/display-rules',
      );
      cache = res.rules;
      cacheExpiry = Date.now() + CACHE_TTL_MS;
    } catch (err) {
      console.error('displayPoints refresh failed:', err);
      // Não bloqueia o cliente: a próxima chamada cai no fallback.
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Devolve o valor de pontos pra um "rule" do cliente.
 *
 * Sempre síncrono: se o cache está cold, retorna o FALLBACK
 * imediatamente e dispara um refresh em background (próximas
 * chamadas pegam o valor real do servidor).
 *
 * Não esperamos o fetch porque a UI quer feedback de 0ms — o
 * toast com o valor antigo na primeira renderização ainda é
 * melhor que esperar 100ms de network. Cache aquece em segundo
 * plano e a próxima chamada já é precisa.
 */
export function getDisplayPoints(rule: string): number {
  const kind = RULE_TO_KIND[rule];
  if (!kind) return 0;

  if (cache && Date.now() < cacheExpiry) {
    return cache[kind] ?? FALLBACK[kind];
  }

  // Dispara refresh assíncrono — não bloqueia o caller.
  void refresh();
  return cache?.[kind] ?? FALLBACK[kind];
}

/** Pré-aquece o cache. Chamável de algum lugar central (ex.: provider
 *  da app shell) pra que o primeiro click no like já encontre o
 *  cache populado. Idempotente. */
export function preloadDisplayPoints(): Promise<void> {
  if (cache && Date.now() < cacheExpiry) return Promise.resolve();
  return refresh();
}
