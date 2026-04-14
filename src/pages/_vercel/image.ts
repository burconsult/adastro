import type { APIRoute } from 'astro';
import { resolveLegacyVercelImageRedirect } from '../../lib/media/vercel-image-redirect.js';

export const GET: APIRoute = ({ url, redirect }) => {
  const target = resolveLegacyVercelImageRedirect(url.searchParams.get('url'), url.origin);

  if (!target) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });
  }

  return redirect(target, 302);
};

export const HEAD = GET;
