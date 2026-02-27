import { afterEach, describe, expect, it } from 'vitest';

import { ALL } from '../mcp';

const ORIGINAL_TOKEN = process.env.MCP_SERVER_TOKEN;

describe('/mcp route auth guards', () => {
  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) {
      delete process.env.MCP_SERVER_TOKEN;
    } else {
      process.env.MCP_SERVER_TOKEN = ORIGINAL_TOKEN;
    }
  });

  it('returns 503 when MCP_SERVER_TOKEN is not configured', async () => {
    delete process.env.MCP_SERVER_TOKEN;

    const request = new Request('https://adastrocms.vercel.app/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const response = await ALL({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toMatch(/not configured/i);
  });

  it('returns 401 when token is configured but auth header is missing', async () => {
    process.env.MCP_SERVER_TOKEN = 'test-token';

    const request = new Request('https://adastrocms.vercel.app/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const response = await ALL({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toMatch(/unauthorized/i);
  });
});

