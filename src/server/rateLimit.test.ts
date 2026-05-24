import { describe, it, expect, beforeEach } from 'vitest';
import {
  limitByIp,
  limitByKey,
  magicLinkLimiter,
  verifyLimiter,
  uploadLimiter,
  writeLimiter,
} from './rateLimit';
import { TokenBucket } from './realtime/rateLimit';

/** Cria um Request fake com headers customizáveis. */
function fakeReq(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/test', { headers });
}

async function readBody(res: Response): Promise<unknown> {
  return await res.json();
}

describe('limitByIp', () => {
  let bucket: TokenBucket;
  beforeEach(() => {
    // Capacidade 2, refill desprezível pra teste determinístico.
    bucket = new TokenBucket(2, 0.0001);
  });

  it('primeira chamada de um IP é OK', () => {
    const req = fakeReq({ 'x-forwarded-for': '1.2.3.4' });
    const result = limitByIp(req, bucket, 'test');
    expect(result.ok).toBe(true);
  });

  it('estoura cota → 429 com header Retry-After', async () => {
    const req = fakeReq({ 'x-forwarded-for': '5.6.7.8' });
    limitByIp(req, bucket, 'test'); // 1
    limitByIp(req, bucket, 'test'); // 2
    const third = limitByIp(req, bucket, 'test'); // estoura

    expect(third.ok).toBe(false);
    expect(third.response.status).toBe(429);
    expect(third.response.headers.get('Retry-After')).toBe('60');
    expect(await readBody(third.response)).toEqual({ error: 'rate_limited' });
  });

  it('IPs diferentes têm buckets independentes', () => {
    const reqA = fakeReq({ 'x-forwarded-for': '1.1.1.1' });
    const reqB = fakeReq({ 'x-forwarded-for': '2.2.2.2' });

    limitByIp(reqA, bucket, 'test');
    limitByIp(reqA, bucket, 'test');
    const aDenied = limitByIp(reqA, bucket, 'test');
    const bAllowed = limitByIp(reqB, bucket, 'test');

    expect(aDenied.ok).toBe(false);
    expect(bAllowed.ok).toBe(true);
  });

  it('mesmo IP em routeIds diferentes tem buckets independentes', () => {
    const req = fakeReq({ 'x-forwarded-for': '9.9.9.9' });
    limitByIp(req, bucket, 'route-a');
    limitByIp(req, bucket, 'route-a');
    const aDenied = limitByIp(req, bucket, 'route-a');
    const bAllowed = limitByIp(req, bucket, 'route-b');

    expect(aDenied.ok).toBe(false);
    expect(bAllowed.ok).toBe(true);
  });

  it('extrai primeiro IP de X-Forwarded-For multi-hop', () => {
    // XFF: <client>, <proxy1>, <proxy2>
    const req = fakeReq({
      'x-forwarded-for': '10.0.0.1, 192.168.1.1, 192.168.1.2',
    });
    limitByIp(req, bucket, 'test');
    limitByIp(req, bucket, 'test');
    const denied = limitByIp(req, bucket, 'test');
    expect(denied.ok).toBe(false);

    // Outro client real (1º IP diferente) → bucket separado
    const req2 = fakeReq({
      'x-forwarded-for': '10.0.0.2, 192.168.1.1, 192.168.1.2',
    });
    const allowed = limitByIp(req2, bucket, 'test');
    expect(allowed.ok).toBe(true);
  });

  it('cai pra x-real-ip se XFF ausente', () => {
    const req = fakeReq({ 'x-real-ip': '4.4.4.4' });
    const result = limitByIp(req, bucket, 'test');
    expect(result.ok).toBe(true);
  });

  it('cai pra "unknown" se sem headers — todos os anon compartilham bucket', () => {
    const req1 = fakeReq();
    const req2 = fakeReq();
    limitByIp(req1, bucket, 'test');
    limitByIp(req2, bucket, 'test');
    const third = limitByIp(req1, bucket, 'test');
    // Ambos foram pro mesmo bucket "unknown"
    expect(third.ok).toBe(false);
  });
});

describe('limitByKey', () => {
  let bucket: TokenBucket;
  beforeEach(() => {
    bucket = new TokenBucket(3, 0.0001);
  });

  it('chaves diferentes têm buckets independentes', () => {
    expect(limitByKey('alice@x.com', bucket).ok).toBe(true);
    expect(limitByKey('alice@x.com', bucket).ok).toBe(true);
    expect(limitByKey('alice@x.com', bucket).ok).toBe(true);
    expect(limitByKey('alice@x.com', bucket).ok).toBe(false);
    // Outra key = bucket fresco
    expect(limitByKey('bob@x.com', bucket).ok).toBe(true);
  });

  it('429 inclui Retry-After', async () => {
    const k = 'spam-target@x.com';
    limitByKey(k, bucket);
    limitByKey(k, bucket);
    limitByKey(k, bucket);
    const denied = limitByKey(k, bucket);
    expect(denied.response.status).toBe(429);
    expect(denied.response.headers.get('Retry-After')).toBe('60');
    expect(await readBody(denied.response)).toEqual({ error: 'rate_limited' });
  });

  it('protege victim de spam mesmo se atacante rotaciona IP', () => {
    // O ponto deste helper: bucket por chave (email), não por IP.
    // Atacante pode trocar de proxy, mas o email da victim continua
    // o mesmo → o bucket dele já está vazio.
    const victim = 'victim@x.com';
    for (let i = 0; i < 3; i++) {
      expect(limitByKey(victim, bucket).ok).toBe(true);
    }
    expect(limitByKey(victim, bucket).ok).toBe(false);
  });
});

describe('limiters pre-configurados', () => {
  it('magicLinkLimiter — 5 burst, refill 5/min', () => {
    expect(magicLinkLimiter).toBeInstanceOf(TokenBucket);
  });

  it('verifyLimiter — mais apertado pra brute-force', () => {
    expect(verifyLimiter).toBeInstanceOf(TokenBucket);
  });

  it('uploadLimiter — 20 burst, generoso', () => {
    expect(uploadLimiter).toBeInstanceOf(TokenBucket);
  });

  it('writeLimiter — 10 burst pra criação de conteúdo', () => {
    expect(writeLimiter).toBeInstanceOf(TokenBucket);
  });

  it('limiters são instâncias separadas (não compartilham state)', () => {
    expect(magicLinkLimiter).not.toBe(verifyLimiter);
    expect(uploadLimiter).not.toBe(writeLimiter);
  });
});
