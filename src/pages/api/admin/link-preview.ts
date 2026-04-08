import type { APIRoute } from 'astro';
import { requireAuthor } from '@/lib/auth/auth-helpers';
import { UnsafeOutboundUrlError, assertSafeOutboundHttpUrl } from '@/lib/security/outbound-urls';

const MAX_HTML_BYTES = 200_000;
const REQUEST_TIMEOUT_MS = 5000;

const parseMetadata = (html: string) => {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const descriptionMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["'][^>]*>/i);
  const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["'][^>]*>/i);
  const ogDescriptionMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["'][^>]*>/i);
  const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["'][^>]*>/i);

  return {
    title: ogTitleMatch?.[1] || titleMatch?.[1] || '',
    description: ogDescriptionMatch?.[1] || descriptionMatch?.[1] || '',
    image: ogImageMatch?.[1] || ''
  };
};

const buildFallbackMeta = (url: string) => {
  try {
    const parsed = new URL(url);
    return {
      title: parsed.hostname,
      description: parsed.pathname !== '/' ? parsed.pathname : '',
      image: ''
    };
  } catch {
    return { title: url, description: '', image: '' };
  }
};

const buildPreviewPayload = async (url: string) => {
  let meta = buildFallbackMeta(url);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Adastro Link Preview',
        'Accept': 'text/html'
      },
      redirect: 'error',
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const html = await response.text();
        const limitedHtml = html.slice(0, MAX_HTML_BYTES);
        const parsed = parseMetadata(limitedHtml);
        meta = {
          title: parsed.title || meta.title,
          description: parsed.description || meta.description,
          image: parsed.image || meta.image
        };
      }
    }
  } catch {
    // Network fetch failures fall back to basic metadata.
  }

  return {
    success: 1,
    meta: {
      title: meta.title,
      description: meta.description,
      image: meta.image ? { url: meta.image } : undefined,
      canonical: url
    },
    link: url
  };
};

const jsonResponse = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

const toPreviewErrorResponse = (error: unknown): Response => {
  if (error instanceof UnsafeOutboundUrlError) {
    return jsonResponse({ success: 0, error: 'URL not allowed' }, 400);
  }

  if (error instanceof Error) {
    if (error.message.includes('Authentication required')) {
      return jsonResponse({ success: 0, error: 'Authentication required' }, 401);
    }
    if (error.message.includes('Author access required')) {
      return jsonResponse({ success: 0, error: 'Author access required' }, 403);
    }
  }

  return jsonResponse({ success: 0, error: 'Failed to preview link' }, 500);
};

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAuthor(request);
    const url = new URL(request.url).searchParams.get('url')?.trim() || '';
    if (!url) {
      return jsonResponse({ success: 0, error: 'Missing URL' }, 400);
    }

    const safeUrl = await assertSafeOutboundHttpUrl(url);
    const payload = await buildPreviewPayload(safeUrl.toString());
    return jsonResponse(payload, 200);
  } catch (error) {
    return toPreviewErrorResponse(error);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAuthor(request);
    const body = await request.json().catch(() => ({}));
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return jsonResponse({ success: 0, error: 'Missing URL' }, 400);
    }

    const safeUrl = await assertSafeOutboundHttpUrl(url);
    const payload = await buildPreviewPayload(safeUrl.toString());
    return jsonResponse(payload, 200);
  } catch (error) {
    return toPreviewErrorResponse(error);
  }
};
