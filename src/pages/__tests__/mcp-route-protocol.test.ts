// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import * as z from 'zod/v4';

vi.mock('@/lib/mcp/server', () => ({
  createAdAstroMcpServer: () => {
    const server = new McpServer({ name: 'mock-adastro-mcp', version: '1.0.0' }, { capabilities: { tools: {} } });
    server.registerTool('ping_tool', {
      description: 'Test tool',
      inputSchema: { value: z.string().optional() }
    }, async (args) => ({
      content: [{ type: 'text', text: JSON.stringify({ ok: true, echo: args.value ?? 'pong' }) }]
    }));
    return server;
  }
}));

import { ALL } from '../mcp';

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const proto = 'http';
  const host = req.headers.host || '127.0.0.1';
  const url = `${proto}://${host}${req.url || '/mcp'}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const method = req.method || 'GET';
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const bodyBuffer = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

  return new Request(url, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : bodyBuffer
  });
}

async function writeWebResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (!response.body) {
    res.end();
    return;
  }
  const arrayBuffer = await response.arrayBuffer();
  res.end(Buffer.from(arrayBuffer));
}

describe('/mcp route protocol', () => {
  let httpServer: ReturnType<typeof createServer>;
  let baseUrl = '';

  beforeAll(async () => {
    process.env.MCP_SERVER_TOKEN = 'mcp-test-token';
    httpServer = createServer(async (req, res) => {
      try {
        const request = await toWebRequest(req);
        const response = await ALL({ request } as any);
        await writeWebResponse(res, response);
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String(error) }));
      }
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const address = httpServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to start test server');
    }
    baseUrl = `http://127.0.0.1:${address.port}/mcp`;
  });

  afterAll(async () => {
    delete process.env.MCP_SERVER_TOKEN;
    if (httpServer) {
      await new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('supports Streamable HTTP client initialization, tools/list and tools/call', async () => {
    const client = new Client({ name: 'route-protocol-test', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(baseUrl), {
      requestInit: {
        headers: {
          Authorization: 'Bearer mcp-test-token'
        }
      }
    });

    await client.connect(transport);

    const listResult = await client.listTools();
    expect(listResult.tools.map((tool) => tool.name)).toContain('ping_tool');

    const callResult = await client.callTool({
      name: 'ping_tool',
      arguments: { value: 'hello' }
    });

    const textBlock = Array.isArray((callResult as any).content)
      ? (callResult as any).content.find((block: any) => block.type === 'text')
      : null;
    expect(textBlock?.text).toContain('"echo":"hello"');

    await transport.close();
  });
});
