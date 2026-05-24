/**
 * Logger estruturado mínimo — uma camada fina sobre console.* que
 * (a) padroniza o formato pra ser grep-friendly em produção,
 * (b) deixa explícito quais são erros vs warns vs info,
 * (c) **ponto único de hook** quando integrarmos Sentry/Datadog
 *     no futuro (basta editar este arquivo, não buscar 50+ chamadas
 *     de console.error pelo codebase).
 *
 * Convenção de uso:
 *   logger.error('feed.upload', err, { userId, filename });
 *   logger.warn('chat.rate-limit', { userId, action: 'send' });
 *   logger.info('auth.magic-link.sent', { email });
 *
 * Decisão consciente: NÃO usamos pino/winston ainda. Adicionar dep
 * só faz sentido quando tivermos transport pra log aggregator
 * (Loki, Datadog, Better Stack). Por ora, console.* já vai pro
 * `docker logs` e isso é suficiente.
 *
 * Para hook em error tracker no futuro:
 *   1. Adicionar Sentry init no entry point (instrumentation.ts)
 *   2. Aqui no `error()`: chamar Sentry.captureException(err) também
 *   3. Nenhum call-site precisa mudar.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

function format(level: LogLevel, scope: string, msg: string): string {
  const ts = new Date().toISOString();
  return `${ts} [${level.toUpperCase()}] ${scope}: ${msg}`;
}

/* ──────────────────────────────────────────────────────────────
 * Transport pluggável — Sentry/Datadog/Better Stack registram
 * via `setErrorTransport()`. Sem transport: só `console.error`.
 *
 * Quando Sentry entrar:
 *
 *   // instrumentation.ts (Next.js)
 *   import * as Sentry from '@sentry/node';
 *   import { setErrorTransport } from '@/server/log';
 *
 *   Sentry.init({ dsn: env.SENTRY_DSN });
 *   setErrorTransport((err, ctx) => {
 *     Sentry.captureException(err, { extra: ctx });
 *   });
 *
 * Cobertura instantânea de TODOS os logger.error() do codebase
 * sem precisar tocar nos call-sites. Esse é o ponto.
 * ────────────────────────────────────────────────────────────── */

type ErrorTransport = (err: unknown, ctx?: LogContext) => void;

let externalTransport: ErrorTransport | undefined;

export function setErrorTransport(transport: ErrorTransport): void {
  externalTransport = transport;
}

export const logger = {
  debug(scope: string, ctx?: LogContext) {
    if (process.env.NODE_ENV === 'production') return;
    console.debug(format('debug', scope, ''), ctx ?? '');
  },

  info(scope: string, ctx?: LogContext) {
    console.log(format('info', scope, ''), ctx ?? '');
  },

  warn(scope: string, ctx?: LogContext) {
    console.warn(format('warn', scope, ''), ctx ?? '');
  },

  /**
   * Erro com payload opcional. Aceita Error ou qualquer thing —
   * extrai .message e .stack quando há.
   *
   * Envia pro transport externo (Sentry/Datadog/etc.) quando
   * `setErrorTransport()` foi chamado no boot. Sem transport,
   * só `console.error` (visível em `docker logs`).
   */
  error(scope: string, err: unknown, ctx?: LogContext) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(format('error', scope, message), {
      ...(ctx ?? {}),
      ...(stack ? { stack } : {}),
    });
    /* Sentry/Datadog opcional — falha do transport NÃO derruba o
     * caller (try/catch defensivo). */
    if (externalTransport) {
      try {
        externalTransport(err, { scope, ...(ctx ?? {}) });
      } catch {
        /* Telemetria broken não pode quebrar o request. Engolimos
         * silenciosamente — o console.error acima já registrou. */
      }
    }
  },
};
