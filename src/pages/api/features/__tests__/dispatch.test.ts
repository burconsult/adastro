import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getFeatureApiHandler: vi.fn(),
  isFeatureActive: vi.fn()
}));

vi.mock('@/lib/features/runtime.js', () => ({
  getFeatureApiHandler: mocks.getFeatureApiHandler
}));

vi.mock('@/lib/features/state.js', () => ({
  isFeatureActive: mocks.isFeatureActive
}));

import { ALL } from '../[feature]/[action].ts';

const createContext = (params: Record<string, string | undefined>) => ({
  request: new Request('http://localhost/api/features/test/action', { method: 'POST' }),
  params,
  locals: { traceId: 'test' }
});

const createGetContext = (params: Record<string, string | undefined>) => ({
  request: new Request('http://localhost/api/features/test/action', { method: 'GET' }),
  params,
  locals: { traceId: 'test' }
});

describe('feature api dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when required params are missing', async () => {
    const response = await ALL(createContext({}) as any);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/required/i);
    expect(mocks.getFeatureApiHandler).not.toHaveBeenCalled();
  });

  it('returns 404 when feature action handler is missing', async () => {
    mocks.getFeatureApiHandler.mockResolvedValue(null);

    const response = await ALL(createContext({ feature: 'comments', action: 'submit' }) as any);
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toMatch(/not found/i);
  });

  it('returns 409 when feature is inactive', async () => {
    mocks.getFeatureApiHandler.mockResolvedValue(vi.fn());
    mocks.isFeatureActive.mockResolvedValue(false);

    const response = await ALL(createContext({ feature: 'newsletter', action: 'subscribe' }) as any);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toMatch(/inactive/i);
  });

  it('returns a safe empty payload for inactive comments list reads', async () => {
    mocks.getFeatureApiHandler.mockResolvedValue(vi.fn());
    mocks.isFeatureActive.mockResolvedValue(false);

    const response = await ALL(createGetContext({ feature: 'comments', action: 'list' }) as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      enabled: false,
      comments: []
    });
  });

  it('dispatches to handler when feature is active', async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    mocks.getFeatureApiHandler.mockResolvedValue(handler);
    mocks.isFeatureActive.mockResolvedValue(true);

    const context = createContext({ feature: 'comments', action: 'submit' });
    const response = await ALL(context as any);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        request: context.request,
        params: context.params,
        locals: context.locals
      })
    );
  });

  it('returns 500 when feature handler throws', async () => {
    mocks.getFeatureApiHandler.mockResolvedValue(
      vi.fn().mockRejectedValue(new Error('handler exploded'))
    );
    mocks.isFeatureActive.mockResolvedValue(true);

    const response = await ALL(createContext({ feature: 'comments', action: 'submit' }) as any);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toMatch(/failed/i);
  });
});
