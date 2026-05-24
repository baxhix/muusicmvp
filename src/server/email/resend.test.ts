import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendEmailWithRetry } from './resend';

/* Mock do logger pra não poluir output dos testes. */
vi.mock('../log', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('sendEmailWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna o resultado quando primeira tentativa sucede', async () => {
    const factory = vi.fn().mockResolvedValue({ id: 'msg_001' });
    const result = await sendEmailWithRetry(factory, { scope: 'test' });
    expect(result).toEqual({ id: 'msg_001' });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('retenta em erro transiente e eventualmente sucede', async () => {
    const factory = vi
      .fn()
      .mockRejectedValueOnce(new Error('503 service unavailable'))
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce({ id: 'msg_002' });

    const result = await sendEmailWithRetry(factory, {
      scope: 'test',
      retries: 2,
      timeoutMs: 1000,
    });

    expect(result).toEqual({ id: 'msg_002' });
    expect(factory).toHaveBeenCalledTimes(3);
  });

  it('lança imediatamente em erro 4xx (não-transiente)', async () => {
    const factory = vi.fn().mockRejectedValue(new Error('400 invalid email'));
    await expect(
      sendEmailWithRetry(factory, { scope: 'test' }),
    ).rejects.toThrow('400 invalid email');
    // Só UMA tentativa — não retenta 4xx
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('falha após esgotar tentativas em erro transiente persistente', async () => {
    const factory = vi.fn().mockRejectedValue(new Error('503'));
    await expect(
      sendEmailWithRetry(factory, { scope: 'test', retries: 2 }),
    ).rejects.toThrow('503');
    // 1 inicial + 2 retries = 3 tentativas
    expect(factory).toHaveBeenCalledTimes(3);
  });

  it('classifica vários patterns como transientes', async () => {
    const transientErrors = [
      'fetch failed',
      'ECONNRESET',
      'ETIMEDOUT',
      '502 bad gateway',
      '504 gateway timeout',
      '429 too many requests',
      'timeout after 8000ms',
    ];
    for (const msg of transientErrors) {
      const factory = vi
        .fn()
        .mockRejectedValueOnce(new Error(msg))
        .mockResolvedValueOnce({ ok: true });
      const result = await sendEmailWithRetry(factory, {
        scope: 'test',
        retries: 1,
      });
      expect(result).toEqual({ ok: true });
      expect(factory).toHaveBeenCalledTimes(2);
    }
  });

  it('respeita o timeout (rejeita Promise pendurada)', async () => {
    const factory = vi.fn(() => new Promise(() => {})); // never resolves
    await expect(
      sendEmailWithRetry(factory, {
        scope: 'test',
        retries: 0,
        timeoutMs: 50,
      }),
    ).rejects.toThrow(/timeout after 50ms/);
  });
});
