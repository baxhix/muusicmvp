/**
 * Erro de API padronizado + helpers de resposta.
 *
 * Convenção do projeto:
 *   - Status code HTTP correto pra o tipo de falha.
 *   - Body JSON sempre `{ error: '<code>' }` (curto, machine-readable).
 *     `code` é minúsculo, snake_case, estável (pode ser mapeado no
 *     cliente pra mensagens user-facing — ver `describeError()` em
 *     admin/services/materiais.ts pro padrão).
 *   - Stack trace nunca vaza pro cliente. Loga via `logger.error()`
 *     com contexto e devolve só o code.
 *
 * Como usar nas rotas:
 *
 *   try {
 *     // ... validação + business logic
 *   } catch (err) {
 *     return handleApiError(err, { scope: 'feed.post.create', userId });
 *   }
 *
 * Ou throw direto via classes de erro custom:
 *
 *   throw new NotFoundError('material');
 *   throw new ValidationError('missing_name');
 *   throw new ForbiddenError();
 *
 * O handler converte cada uma no status + payload corretos.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from '../log';

/* ──────────────────────────────────────────────────────────────
 * Hierarquia de erros — cada um já carrega status code certo.
 * ────────────────────────────────────────────────────────────── */

/** Erro de validação de input (400). Body inválido, params faltando, etc. */
export class ValidationError extends Error {
  constructor(public readonly code: string, message?: string) {
    super(message ?? code);
    this.name = 'ValidationError';
  }
}

/** Não autenticado (401). Token expirou, cookie ausente, etc. */
export class UnauthorizedError extends Error {
  constructor(public readonly code: string = 'unauthorized') {
    super(code);
    this.name = 'UnauthorizedError';
  }
}

/** Autenticado mas sem permissão (403). Não-admin acessando rota admin, etc. */
export class ForbiddenError extends Error {
  constructor(public readonly code: string = 'forbidden') {
    super(code);
    this.name = 'ForbiddenError';
  }
}

/** Recurso não existe (404). */
export class NotFoundError extends Error {
  constructor(public readonly code: string = 'not_found') {
    super(code);
    this.name = 'NotFoundError';
  }
}

/** Conflito de estado (409). Email duplicado, slug em uso, race condition. */
export class ConflictError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'ConflictError';
  }
}

/** Rate limit excedido (429). */
export class RateLimitError extends Error {
  constructor(public readonly code: string = 'rate_limited') {
    super(code);
    this.name = 'RateLimitError';
  }
}

/** Integração externa falhou (502). Resend down, Mapbox timeout, etc. */
export class UpstreamError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'UpstreamError';
  }
}

/* ──────────────────────────────────────────────────────────────
 * Helper central
 * ────────────────────────────────────────────────────────────── */

export interface HandleApiErrorOptions {
  /** Identificador grep-friendly do site da falha. Ex: 'feed.post.create'. */
  scope: string;
  /** Contexto opcional pra log (userId, params, etc.). Não vai pro cliente. */
  ctx?: Record<string, unknown>;
}

/**
 * Normaliza qualquer erro num NextResponse JSON com status correto +
 * loga internamente. Use em todos os `catch` das rotas:
 *
 *   } catch (err) {
 *     return handleApiError(err, { scope: 'admin.materiais.delete' });
 *   }
 *
 * Mapeamento:
 *   ValidationError / ZodError → 400 + { error: code | 'invalid_body' }
 *   UnauthorizedError          → 401 + { error: code }
 *   ForbiddenError             → 403 + { error: code }
 *   NotFoundError              → 404 + { error: code }
 *   ConflictError              → 409 + { error: code }
 *   RateLimitError             → 429 + { error: code }
 *   UpstreamError              → 502 + { error: code }
 *   Qualquer outro             → 500 + { error: 'internal_error' }
 *
 * Stack trace nunca vai pro cliente; só logger.error() recebe.
 */
export function handleApiError(
  err: unknown,
  opts: HandleApiErrorOptions,
): NextResponse {
  // ── Erros conhecidos (esperados) ─────────────────────
  if (err instanceof ValidationError) {
    logger.warn(opts.scope, { code: err.code, ...opts.ctx });
    return NextResponse.json({ error: err.code }, { status: 400 });
  }
  if (err instanceof ZodError) {
    // Zod errors são sempre de validação. Logamos os issues mas
    // devolvemos só 'invalid_body' (não exponha schema interno).
    logger.warn(opts.scope, {
      code: 'invalid_body',
      issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
      ...opts.ctx,
    });
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.code }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.code }, { status: 403 });
  }
  if (err instanceof NotFoundError) {
    return NextResponse.json({ error: err.code }, { status: 404 });
  }
  if (err instanceof ConflictError) {
    logger.info(opts.scope, { code: err.code, ...opts.ctx });
    return NextResponse.json({ error: err.code }, { status: 409 });
  }
  if (err instanceof RateLimitError) {
    return NextResponse.json({ error: err.code }, { status: 429 });
  }
  if (err instanceof UpstreamError) {
    logger.error(opts.scope, err, opts.ctx);
    return NextResponse.json({ error: err.code }, { status: 502 });
  }

  // ── Erro inesperado ──────────────────────────────────
  // Loga com stack pra debug, retorna mensagem genérica.
  logger.error(opts.scope, err, opts.ctx);
  return NextResponse.json({ error: 'internal_error' }, { status: 500 });
}
