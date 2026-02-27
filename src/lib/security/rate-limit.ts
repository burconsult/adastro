type RateLimitBucket = {
  hits: number[];
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
};

const store = new Map<string, RateLimitBucket>();

export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const minTimestamp = now - options.windowMs;
  const bucket = store.get(options.key) ?? { hits: [] };

  bucket.hits = bucket.hits.filter((timestamp) => timestamp > minTimestamp);

  if (bucket.hits.length >= options.limit) {
    const oldest = bucket.hits[0] ?? now;
    const retryAfterMs = Math.max(0, options.windowMs - (now - oldest));
    store.set(options.key, bucket);
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      remaining: 0
    };
  }

  bucket.hits.push(now);
  store.set(options.key, bucket);
  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, options.limit - bucket.hits.length)
  };
}

export function resetRateLimitStore(): void {
  store.clear();
}
