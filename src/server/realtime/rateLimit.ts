/**
 * Tiny in-memory token bucket for per-user rate limiting on the
 * socket handlers. Each bucket holds `capacity` tokens that refill
 * at `refillRate` tokens per second. A request `consume`s one (or
 * more) tokens; if there aren't enough, the request is rejected.
 *
 * In-memory is fine for a single socket process. Once we add the
 * Redis adapter (item 4 of the capacity plan) we'll either move
 * this to Redis or accept that the limit is per-process (which is
 * usually OK: a malicious client can't pin to a specific instance).
 *
 * Stale buckets are evicted periodically so the Map doesn't grow
 * unbounded as users come and go over weeks.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class TokenBucket {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    /** Max burst — buckets start full and never exceed this. */
    private readonly capacity: number,
    /** Steady-state refill rate, tokens per second. */
    private readonly refillRate: number,
  ) {}

  /**
   * Try to consume `cost` tokens for `key`. Returns true when allowed
   * (and decrements the bucket) or false when rate-limited (and
   * leaves the bucket untouched).
   */
  consume(key: string, cost = 1): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? {
      tokens: this.capacity,
      lastRefill: now,
    };

    // Refill based on elapsed wall time.
    const elapsedSec = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      this.capacity,
      bucket.tokens + elapsedSec * this.refillRate,
    );
    bucket.lastRefill = now;

    if (bucket.tokens < cost) {
      this.buckets.set(key, bucket);
      return false;
    }
    bucket.tokens -= cost;
    this.buckets.set(key, bucket);
    return true;
  }

  /** Drop buckets idle for more than `maxAgeMs`. */
  evictStale(maxAgeMs = 60_000): void {
    const cutoff = Date.now() - maxAgeMs;
    for (const [key, bucket] of this.buckets) {
      // A bucket idle this long has refilled to full anyway, so
      // dropping it is equivalent to keeping it.
      if (bucket.lastRefill < cutoff) this.buckets.delete(key);
    }
  }

  /** Current population (for diagnostics / metrics). */
  size(): number {
    return this.buckets.size;
  }
}

// Pre-configured per-action buckets. Numbers tuned for "well-behaved
// chat client" + small safety margin for typing-while-clicking flows.
// Reactions are a bit more generous since users do bulk reactions on
// hot messages (laughter cascade pattern).
export const sendBucket   = new TokenBucket(15, 10);  // 10/s steady, burst 15
export const reactBucket  = new TokenBucket(40, 30);  // 30/s steady, burst 40
export const typingBucket = new TokenBucket(10,  5);  //  5/s steady, burst 10
export const joinBucket   = new TokenBucket(20, 10);  // 10/s — chat:join + chat:leave

// One eviction sweep per minute. unref() so this timer never blocks
// process shutdown.
setInterval(() => {
  sendBucket.evictStale();
  reactBucket.evictStale();
  typingBucket.evictStale();
  joinBucket.evictStale();
}, 60_000).unref();
