import { timingSafeEqual } from 'node:crypto';

const AUTH_HEADER_NAMES = ['authorization', 'Authorization'] as const;
const ALT_TOKEN_HEADER_NAMES = ['x-adastro-mcp-token', 'X-AdAstro-Mcp-Token'] as const;

function extractBearerToken(request: Request): string | null {
  for (const headerName of AUTH_HEADER_NAMES) {
    const headerValue = request.headers.get(headerName);
    if (!headerValue) continue;
    if (!headerValue.toLowerCase().startsWith('bearer ')) continue;
    const token = headerValue.slice(7).trim();
    return token || null;
  }

  for (const headerName of ALT_TOKEN_HEADER_NAMES) {
    const token = request.headers.get(headerName)?.trim();
    if (token) return token;
  }

  return null;
}

function safeTokenMatch(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function getConfiguredMcpToken(): string | null {
  const token = process.env.MCP_SERVER_TOKEN?.trim();
  return token ? token : null;
}

export function isMcpTokenConfigured(): boolean {
  return Boolean(getConfiguredMcpToken());
}

export function isMcpAuthorized(request: Request): boolean {
  const configuredToken = getConfiguredMcpToken();
  if (!configuredToken) return false;

  const providedToken = extractBearerToken(request);
  if (!providedToken) return false;

  return safeTokenMatch(configuredToken, providedToken);
}

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export function createMcpTokenMissingResponse(): Response {
  return jsonResponse({
    error: 'MCP endpoint is not configured',
    details: 'Set MCP_SERVER_TOKEN to enable /mcp access.'
  }, 503);
}

export function createMcpUnauthorizedResponse(): Response {
  return jsonResponse({
    error: 'Unauthorized',
    details: 'Provide Authorization: Bearer <MCP_SERVER_TOKEN>.'
  }, 401);
}

