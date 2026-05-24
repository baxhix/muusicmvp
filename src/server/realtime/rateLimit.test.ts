import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TokenBucket } from './rateLimit';

describe('TokenBucket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('permite burst até capacity', () => {
    const b = new TokenBucket(5, 1); // 5 burst, 1 token/s
    for (let i = 0; i < 5; i++) {
      expect(b.consume('user-a')).toBe(true);
    }
    // 6ª chamada — bucket vazio, esperado false
    expect(b.consume('user-a')).toBe(false);
  });

  it('refilla em wall time', () => {
    const b = new TokenBucket(3, 1); // 1 token/s
    b.consume('user-a');
    b.consume('user-a');
    b.consume('user-a');
    expect(b.consume('user-a')).toBe(false);

    // Avança 2s — deveria recuperar 2 tokens
    vi.advanceTimersByTime(2000);
    expect(b.consume('user-a')).toBe(true);
    expect(b.consume('user-a')).toBe(true);
    expect(b.consume('user-a')).toBe(false);
  });

  it('não excede capacity ao refillar (bucket cheio)', () => {
    const b = new TokenBucket(3, 10); // 10 tokens/s
    b.consume('user-a'); // tokens = 2

    // Avança 10s — refillaria 100 tokens, mas cap em 3
    vi.advanceTimersByTime(10_000);
    expect(b.consume('user-a')).toBe(true);
    expect(b.consume('user-a')).toBe(true);
    expect(b.consume('user-a')).toBe(true);
    expect(b.consume('user-a')).toBe(false);
  });

  it('isola buckets por key (user-a não afeta user-b)', () => {
    const b = new TokenBucket(2, 0); // sem refill, isolation test
    expect(b.consume('user-a')).toBe(true);
    expect(b.consume('user-a')).toBe(true);
    expect(b.consume('user-a')).toBe(false);
    // user-b tem seu próprio bucket cheio
    expect(b.consume('user-b')).toBe(true);
    expect(b.consume('user-b')).toBe(true);
  });

  it('consume com cost > 1 deduz N tokens', () => {
    const b = new TokenBucket(10, 0);
    expect(b.consume('user-a', 7)).toBe(true);
    expect(b.consume('user-a', 4)).toBe(false); // só 3 tokens restantes
    expect(b.consume('user-a', 3)).toBe(true);
  });

  it('cost > capacity sempre falha (não pode satisfazer)', () => {
    const b = new TokenBucket(5, 0);
    expect(b.consume('user-a', 10)).toBe(false);
    // E não consome nada nesse caso
    expect(b.consume('user-a', 5)).toBe(true);
  });

  it('evictStale remove buckets idle > maxAgeMs', () => {
    const b = new TokenBucket(5, 1);
    b.consume('user-a');
    b.consume('user-b');
    expect(b.size()).toBe(2);

    vi.advanceTimersByTime(120_000); // 2 min
    b.evictStale(60_000);            // limite 1 min
    expect(b.size()).toBe(0);
  });

  it('evictStale preserva buckets recém-usados', () => {
    const b = new TokenBucket(5, 1);
    b.consume('user-a');
    vi.advanceTimersByTime(30_000);
    b.consume('user-b'); // toca b agora

    b.evictStale(60_000);
    // user-a tem 30s idle → preservado (< 60s)
    // user-b acabou de tocar → preservado
    expect(b.size()).toBe(2);

    vi.advanceTimersByTime(50_000); // user-a agora tem 80s, user-b tem 50s
    b.evictStale(60_000);
    expect(b.size()).toBe(1); // só user-b sobrou
  });
});
