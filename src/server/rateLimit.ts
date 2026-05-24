/**
 * Rate limiting pra rotas HTTP — wrapper sobre `TokenBucket` da
 * camada de socket, expondo helpers convenientes pra Next.js API
 * routes.
 *
 * IMPORTANTE: in-memory. Quando rodar múltiplas instâncias web
 * (futuro), substituir por um adapter Redis. Hoje, com 1 processo
 * web, é OK — todos os requests passam pelo mesmo buckets Map.
 *
 * Uso típico em route handler:
 *
 *   const rl = await limitByIp(req, magicLinkLimiter);
 *   if (!rl.ok) return rl.response;
 *   // ... continua o handler
 */

import { NextResponse } from 'next/server';
import { TokenBucket } from './realtime/rateLimit';

/* ──────────────────────────────────────────────────────────────
 * Pre-configured buckets por rota crítica.
 * Tuning: ser generoso o bastante pra typos honestos (digitar
 * o email errado e refazer) + apertado o suficiente pra parar
 * bots. Magic link: 5/min por IP é "humano clicando rápido";
 * mais que isso é provavelmente abuse.
 * ────────────────────────────────────────────────────────────── */

/** Magic link request: 5 burst, refill ~0.083/s = 5/min sustentado. */
export const magicLinkLimiter = new TokenBucket(5, 0.083);

/** Verificação de OTP: mais apertado pra dificultar brute-force.
 *  10 tentativas burst, refill 0.05/s = 3/min sustentado. Acima
 *  disso o atacante teria que esperar entre tentativas. */
export const verifyLimiter = new TokenBucket(10, 0.05);

/* ──────────────────────────────────────────────────────────────
 * Helpers HTTP
 * ────────────────────────────────────────────────────────────── */

/** Extrai o IP do cliente atrás de proxy/nginx. Em dev local
 *  (sem header X-Forwarded-For), cai pra 'unknown' que vira
 *  bucket compartilhado mas inofensivo. */
function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    /* Primeira entrada é o IP original do cliente. */
    return xff.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export interface RateLimitResult {
  ok: boolean;
  /** Pre-built 429 response — só usar se ok=false. */
  response: NextResponse;
}

/** Aplica rate limit baseado no IP do request. Retorna `{ ok, response }`. */
export function limitByIp(
  req: Request,
  bucket: TokenBucket,
  routeId = 'route',
): RateLimitResult {
  const ip = clientIp(req);
  const key = `${routeId}:${ip}`;
  if (bucket.consume(key)) {
    return {
      ok: true,
      response: NextResponse.json({}, { status: 200 }),
    };
  }
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'rate_limited' },
      {
        status: 429,
        headers: {
          /* RFC 6585: dica pro cliente esperar antes de retry */
          'Retry-After': '60',
        },
      },
    ),
  };
}

/** Aplica rate limit por chave arbitrária (ex: email).
 *  Útil pra proteger uma victim de inbox spam: alguém pode
 *  trocar de IP, mas não consegue spam de email pra um
 *  endereço específico. */
export function limitByKey(
  key: string,
  bucket: TokenBucket,
): RateLimitResult {
  if (bucket.consume(key)) {
    return {
      ok: true,
      response: NextResponse.json({}, { status: 200 }),
    };
  }
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'rate_limited' },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      },
    ),
  };
}
