import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodError, z } from 'zod';
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  UpstreamError,
  handleApiError,
} from './errors';

// Mock do logger pra inspecionar chamadas sem poluir stdout.
vi.mock('../log', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Re-importa o mock pra fazer assertions.
import { logger } from '../log';

beforeEach(() => {
  vi.clearAllMocks();
});

/** Helper: extrai body JSON de NextResponse de forma síncrona via test util. */
async function readBody(res: Response): Promise<unknown> {
  return await res.json();
}

describe('handleApiError — classes custom', () => {
  it('ValidationError → 400 + code do erro', async () => {
    const res = handleApiError(new ValidationError('missing_email'), {
      scope: 'auth.request',
    });
    expect(res.status).toBe(400);
    expect(await readBody(res)).toEqual({ error: 'missing_email' });
    expect(logger.warn).toHaveBeenCalledWith(
      'auth.request',
      expect.objectContaining({ code: 'missing_email' }),
    );
  });

  it('UnauthorizedError → 401', async () => {
    const res = handleApiError(new UnauthorizedError(), {
      scope: 'feed.read',
    });
    expect(res.status).toBe(401);
    expect(await readBody(res)).toEqual({ error: 'unauthorized' });
  });

  it('UnauthorizedError com code custom → 401 + code', async () => {
    const res = handleApiError(new UnauthorizedError('token_expired'), {
      scope: 'feed.read',
    });
    expect(res.status).toBe(401);
    expect(await readBody(res)).toEqual({ error: 'token_expired' });
  });

  it('ForbiddenError → 403', async () => {
    const res = handleApiError(new ForbiddenError(), { scope: 'admin.read' });
    expect(res.status).toBe(403);
    expect(await readBody(res)).toEqual({ error: 'forbidden' });
  });

  it('NotFoundError → 404', async () => {
    const res = handleApiError(new NotFoundError('material_not_found'), {
      scope: 'materiais.read',
    });
    expect(res.status).toBe(404);
    expect(await readBody(res)).toEqual({ error: 'material_not_found' });
  });

  it('ConflictError → 409 + loga em info (esperado)', async () => {
    const res = handleApiError(new ConflictError('email_in_use'), {
      scope: 'auth.signup',
    });
    expect(res.status).toBe(409);
    expect(await readBody(res)).toEqual({ error: 'email_in_use' });
    expect(logger.info).toHaveBeenCalled();
  });

  it('RateLimitError → 429', async () => {
    const res = handleApiError(new RateLimitError(), { scope: 'auth.verify' });
    expect(res.status).toBe(429);
    expect(await readBody(res)).toEqual({ error: 'rate_limited' });
  });

  it('UpstreamError → 502 + loga como erro', async () => {
    const res = handleApiError(new UpstreamError('resend_timeout'), {
      scope: 'email.send',
    });
    expect(res.status).toBe(502);
    expect(await readBody(res)).toEqual({ error: 'resend_timeout' });
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('handleApiError — ZodError', () => {
  it('ZodError → 400 + "invalid_body" (não vaza schema)', async () => {
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse({ email: 'not-an-email' });
    if (result.success) throw new Error('expected zod failure');

    const res = handleApiError(result.error, { scope: 'auth.request' });
    expect(res.status).toBe(400);
    const body = (await readBody(res)) as Record<string, unknown>;
    expect(body.error).toBe('invalid_body');
    // schema interno não deve vazar pro cliente
    expect(body.issues).toBeUndefined();
  });

  it('logger.warn recebe os issues pra debug interno', () => {
    // Constrói um ZodError real via parse falho — mais robusto que
    // montar o issue manualmente (formato muda entre versões do Zod).
    const schema = z.object({ email: z.string() });
    const parsed = schema.safeParse({});
    if (parsed.success) throw new Error('expected failure');
    const zErr = parsed.error;
    handleApiError(zErr, { scope: 'auth.request', ctx: { ip: '1.2.3.4' } });
    expect(logger.warn).toHaveBeenCalledWith(
      'auth.request',
      expect.objectContaining({
        code: 'invalid_body',
        issues: expect.any(Array),
        ip: '1.2.3.4',
      }),
    );
  });
});

describe('handleApiError — erros desconhecidos', () => {
  it('Error genérico → 500 + "internal_error" (não vaza mensagem)', async () => {
    const res = handleApiError(new Error('SELECT failed: secret password=abc'), {
      scope: 'db.query',
    });
    expect(res.status).toBe(500);
    const body = (await readBody(res)) as Record<string, unknown>;
    expect(body.error).toBe('internal_error');
    // Mensagem interna NUNCA vaza
    expect(JSON.stringify(body)).not.toContain('password');
    expect(JSON.stringify(body)).not.toContain('SELECT');
  });

  it('string lançada → 500', async () => {
    const res = handleApiError('algo deu errado', { scope: 'misc' });
    expect(res.status).toBe(500);
    expect(await readBody(res)).toEqual({ error: 'internal_error' });
  });

  it('null lançado → 500', async () => {
    const res = handleApiError(null, { scope: 'misc' });
    expect(res.status).toBe(500);
  });

  it('logger.error é chamado com stack pra erros 500', () => {
    const err = new Error('boom');
    handleApiError(err, { scope: 'feed.create', ctx: { userId: 'u1' } });
    expect(logger.error).toHaveBeenCalledWith(
      'feed.create',
      err,
      expect.objectContaining({ userId: 'u1' }),
    );
  });
});

describe('handleApiError — sanitização', () => {
  it('nunca expõe stack trace no body do response', async () => {
    const err = new Error('with stack');
    const res = handleApiError(err, { scope: 'test' });
    const body = (await readBody(res)) as Record<string, unknown>;
    expect(body.stack).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('at ');
  });

  it('body é sempre objeto JSON com chave "error"', async () => {
    const cases = [
      new ValidationError('a'),
      new UnauthorizedError(),
      new ForbiddenError(),
      new NotFoundError(),
      new ConflictError('c'),
      new RateLimitError(),
      new UpstreamError('u'),
      new Error('generic'),
    ];
    for (const err of cases) {
      const res = handleApiError(err, { scope: 'test' });
      const body = (await readBody(res)) as Record<string, unknown>;
      expect(typeof body.error).toBe('string');
      expect((body.error as string).length).toBeGreaterThan(0);
    }
  });
});
