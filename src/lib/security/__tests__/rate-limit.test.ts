import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, resetRateLimitStore } from '../rate-limit.js';

describe('rate limiter', () => {
  beforeEach(() => {
    resetRateLimitStore();
    vi.useRealTimers();
  });

  it('allows requests up to the limit', () => {
    const first = checkRateLimit({ key: 'test-key', limit: 2, windowMs: 60_000 });
    const second = checkRateLimit({ key: 'test-key', limit: 2, windowMs: 60_000 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
  });

  it('blocks requests beyond the limit', () => {
    checkRateLimit({ key: 'test-key', limit: 1, windowMs: 60_000 });
    const blocked = checkRateLimit({ key: 'test-key', limit: 1, windowMs: 60_000 });

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('allows requests again after the window expires', () => {
    vi.useFakeTimers();

    checkRateLimit({ key: 'test-key', limit: 1, windowMs: 1000 });
    const blocked = checkRateLimit({ key: 'test-key', limit: 1, windowMs: 1000 });
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(1100);
    const allowedAgain = checkRateLimit({ key: 'test-key', limit: 1, windowMs: 1000 });
    expect(allowedAgain.allowed).toBe(true);
  });
});
