import { Resend } from 'resend';
import { env } from '../env';
import { logger } from '../log';

let client: Resend | undefined;

/**
 * Lazy Resend client — instantiated on first call so module-load doesn't
 * trigger env validation (which fails during Next's build-time page-data
 * collection where runtime envs aren't set).
 */
export function getResend(): Resend {
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

/* ──────────────────────────────────────────────────────────────
 * Reliability wrapper — timeout + retry exponencial.
 *
 * Razão: Resend ocasionalmente devolve 5xx ou trava por 30s+
 * quando há instabilidade no upstream. Sem timeout, uma chamada
 * pendurada prende o handler da request (e a conexão DB que ele
 * carrega) por minutos. Sem retry, qualquer falha transiente
 * vira falha permanente para o usuário.
 *
 * Config padrão:
 *   - timeout 8s por tentativa (suficiente pra Resend saudável;
 *     curto o bastante pra não derrubar UX);
 *   - 2 retries (3 tentativas no total);
 *   - backoff exponencial: 200ms, 800ms entre tentativas;
 *   - só retenta erros transientes (5xx, network, timeout).
 *     4xx (email inválido, quota) NÃO retenta.
 * ────────────────────────────────────────────────────────────── */

interface SendWithRetryOpts {
  /** Identificador de log pra distinguir entre tipos de email. */
  scope: string;
  /** Quantas tentativas adicionais após a primeira. Default 2. */
  retries?: number;
  /** Timeout por tentativa, em ms. Default 8000. */
  timeoutMs?: number;
}

const TRANSIENT_REGEX = /timeout|network|fetch failed|ECONNRESET|ETIMEDOUT|503|502|504|429/i;

function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return TRANSIENT_REGEX.test(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Promise-race wrapper que rejeita se a Promise demorar mais
 * que `ms`. Usado por chamada — não cancela a fetch original
 * (Resend SDK não expõe AbortController), mas libera o handler
 * pra responder ao cliente em vez de pendurar.
 */
function withTimeout<T>(p: Promise<T>, ms: number, scope: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${scope} timeout after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Envia email via Resend com timeout + retry exponencial.
 *
 * Recebe um *factory* que dispara o send (não a Promise direta),
 * pra que cada retry crie uma chamada nova.
 *
 *   await sendEmailWithRetry(
 *     () => getResend().emails.send({ from, to, subject, html }),
 *     { scope: 'auth.magic-link' },
 *   );
 *
 * Lança o último erro se TODAS as tentativas falharem. 4xx (não
 * transiente) lança imediatamente sem retry.
 */
export async function sendEmailWithRetry<T>(
  factory: () => Promise<T>,
  opts: SendWithRetryOpts,
): Promise<T> {
  const retries = opts.retries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 8000;
  // Backoff em ms — primeira espera 200, segunda 800, terceira 2400, ...
  const backoff = (attempt: number) => 200 * Math.pow(4, attempt);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await withTimeout(factory(), timeoutMs, opts.scope);
      if (attempt > 0) {
        logger.info(opts.scope, { recovered_after_attempts: attempt });
      }
      return result;
    } catch (err) {
      lastErr = err;
      const transient = isTransient(err);
      const willRetry = transient && attempt < retries;
      logger.warn(opts.scope, {
        attempt: attempt + 1,
        max_attempts: retries + 1,
        transient,
        will_retry: willRetry,
        message: err instanceof Error ? err.message : String(err),
      });
      if (!willRetry) break;
      await sleep(backoff(attempt));
    }
  }
  throw lastErr;
}
