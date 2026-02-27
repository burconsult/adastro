import type { APIRoute } from 'astro';
import { requireAuthor } from '@/lib/auth/auth-helpers';

const MAX_HTML_BYTES = 200_000;
const REQUEST_TIMEOUT_MS = 5000;

const isPrivateHostname = (hostname: string): boolean => {
  const lower = hostname.toLowerCase();

  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower === '0.0.0.0'
  ) {
    return true;
  }

  if (lower.includes(':')) {
    return lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd');
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(lower)) {
    const [a, b] = lower.split('.').map(Number);
    if (a === 10 || a === 127 || a === 169 && b === 254 || a === 192 && b === 168) {
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
  }

  return false;
};

const isSafeUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    if (parsed.username || parsed.password) {
      return false;
    }
    return !isPrivateHostname(parsed.hostname);
  } catch {
    return false;
  }
};

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

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAuthor(request);
    const url = new URL(request.url).searchParams.get('url')?.trim() || '';
    if (!url) {
      return new Response(JSON.stringify({ success: 0, error: 'Missing URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!isSafeUrl(url)) {
      return new Response(JSON.stringify({ success: 0, error: 'URL not allowed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = await buildPreviewPayload(url);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify({ success: 0, error: 'Failed to preview link' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAuthor(request);
    const body = await request.json().catch(() => ({}));
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return new Response(JSON.stringify({ success: 0, error: 'Missing URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!isSafeUrl(url)) {
      return new Response(JSON.stringify({ success: 0, error: 'URL not allowed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = await buildPreviewPayload(url);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: 0, error: 'Failed to preview link' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
