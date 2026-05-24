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
   * extrai .message e .stack quando há. Se você está pensando
   * "deveria ter um Sentry aqui" — sim. Mas é um change futuro
   * de UMA linha, não 50.
   */
  error(scope: string, err: unknown, ctx?: LogContext) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(format('error', scope, message), {
      ...(ctx ?? {}),
      ...(stack ? { stack } : {}),
    });
    /* HOOK FUTURO: Sentry.captureException(err, { contexts: { ctx } }) */
  },
};
