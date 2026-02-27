import type { APIRoute } from 'astro';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import {
  createMcpTokenMissingResponse,
  createMcpUnauthorizedResponse,
  isMcpAuthorized,
  isMcpTokenConfigured
} from '@/lib/mcp/auth';
import { createAdAstroMcpServer } from '@/lib/mcp/server';

export const prerender = false;

function createJsonRpcErrorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    error: {
      code: -32603,
      message
    },
    id: null
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export const ALL: APIRoute = async ({ request }) => {
  if (!isMcpTokenConfigured()) {
    return createMcpTokenMissingResponse();
  }

  if (!isMcpAuthorized(request)) {
    return createMcpUnauthorizedResponse();
  }

  const server = createAdAstroMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return response;
  } catch (error) {
    console.error('MCP endpoint error:', error);
    return createJsonRpcErrorResponse('Internal server error');
  } finally {
    try {
      await transport.close();
    } catch {
      // ignore transport close errors on stateless requests
    }
    try {
      await server.close();
    } catch {
      // ignore server close errors on stateless requests
    }
  }
};

