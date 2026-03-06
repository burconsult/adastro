# AdAstro Remote MCP Server

AdAstro ships a built-in **remote MCP server** at `/mcp` for AI tools that support MCP over HTTP.

The MCP surface is split into:
- **core tools** (always available)
- **feature tools** (registered only when the feature is active)

This keeps MCP modular: inactive features do not leak tools.

## Enable It

Set an env var on your deployment and redeploy:

```bash
MCP_SERVER_TOKEN=<long-random-secret>
```

Request auth:

```http
Authorization: Bearer <MCP_SERVER_TOKEN>
```

If `MCP_SERVER_TOKEN` is not set, `/mcp` returns `503`.

## Endpoint

- Hosted: `https://your-site.example/mcp`
- Demo example: `https://adastrocms.vercel.app/mcp`

The endpoint is available after install/setup is complete (the normal setup gate still applies).

## Core Tool Groups

### Status / Config
- `adastro_status`
- `settings_get`
- `settings_update`
- `analytics_summary`

### Content Discovery
- `authors_list`
- `categories_list`
- `tags_list`
- `media_list`
- `media_get`
- `posts_list`
- `post_get`
- `pages_list`
- `page_get`

### Publishing Actions
- `post_create`
- `post_update`
- `post_publish`
- `post_unpublish`
- `page_create`
- `page_update`

## Feature Tool Groups (Active Features Only)

### AI Feature (`ai`)
- `ai_post_image_generate`
- `ai_post_audio_generate`

### Comments Feature (`comments`)
- `comments_queue_list`
- `comments_moderate`

Notes:
- Feature tool names are required to start with `<featureId>_`.
- Duplicate tool names are skipped fail-closed.
- If feature tool registration fails, core tools remain available.

## Notes for Agents

- Prefer `*_list` / `*_get` tools before mutating tools.
- Use `authors_list` first if you need an `authorId`.
- `post_create` / `page_create` auto-generate slugs from titles when omitted.
- `post_create` / `post_update` accept plain `content` or EditorJS `blocks`.
- `page_create` / `page_update` accept section arrays for the page builder.
- Mutating tools return MCP tool results; some clients normalize server tool errors into generic "MCP error ..." messages.

## Security Model

- Single bearer token (`MCP_SERVER_TOKEN`) for server-to-server use.
- No browser auth/session cookies required.
- No arbitrary database query execution.
- Reuses existing AdAstro repositories/services (same validation and business rules as the admin API).
- Feature tools are availability-gated by feature state (`features.<id>.enabled`) before registration.

Recommended hardening for production:
- Keep the token secret and rotate if shared with a new tool/user.
- Use HTTPS only.
- Optionally restrict access by IP or a reverse proxy in front of `/mcp`.

## Example Client Configuration (Generic)

Most MCP-capable tools need:
- server URL: `https://your-site.example/mcp`
- bearer token header: `Authorization: Bearer ...`

If your client supports custom headers, add the bearer token there.

## Implementation Notes

- Transport: MCP Streamable HTTP (official TypeScript SDK), stateless mode
- Route: `/src/pages/mcp.ts`
- Core tool registration: `/src/lib/mcp/server.ts`
- Feature MCP extension discovery: `/src/lib/features/runtime.ts`
- Feature MCP extension contracts: `/src/lib/features/types.ts`
- Auth guard: `/src/lib/mcp/auth.ts`
