import type { APIRoute } from 'astro';
import { resolveSiteUrl } from '../lib/url/site-url.js';

const DISALLOWED_PATHS = ['/admin', '/api', '/auth', '/setup', '/profile', '/mcp'];

export const GET: APIRoute = async ({ request }) => {
  const siteUrl = resolveSiteUrl(request, import.meta.env.SITE).replace(/\/$/, '');
  const lines = ['User-agent: *'];

  for (const path of DISALLOWED_PATHS) {
    lines.push(`Disallow: ${path}`);
  }

  lines.push('', `Sitemap: ${siteUrl}/sitemap.xml`);

  return new Response(`${lines.join('\n')}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
