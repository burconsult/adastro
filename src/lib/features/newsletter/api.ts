import { getAuthenticatedUser, requireAdmin, requireAuthor } from '@/lib/auth/auth-helpers';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { getClientIp } from '@/lib/security/request-guards';
import type { FeatureApiHandler, FeatureApiModule } from '../types.js';
import { loadNewsletterRuntimeSettings, toPublicNewsletterMeta, buildNewsletterAdminStatus } from './lib/config-service.js';
import {
  EMAIL_RE,
  normalizeEmail,
  subscribeNewsletter,
  confirmNewsletterSubscription,
  unsubscribeNewsletterSubscription,
  getNewsletterSubscriptionStatus
} from './lib/subscription-service.js';
import { NewsletterFeatureError } from './lib/types.js';
import {
  resolveCampaignArticles,
  resolveCampaignPostPayload,
  loadCampaignArticles,
  loadNewsletterRecipients,
  listNewsletterSubscribers,
  getNewsletterSubscriberSummary,
  getNewsletterCampaignSummary,
  listRecentNewsletterCampaigns
} from './lib/campaign-service.js';
import { buildCampaignMessage, buildPostMessage } from './lib/template-service.js';
import { sendNewsletterMessage, sendAuditedNewsletterCampaign } from './lib/delivery-service.js';

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const html = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });

const empty = (status = 200) =>
  new Response('', {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });

const methodNotAllowed = () => json({ error: 'Method not allowed' }, 405);

const sanitizeText = (value: unknown, maxLength: number) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, maxLength);

const toBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
  }
  return false;
};

const dedupeStringList = (value: unknown, maxItems: number, maxItemLength: number): string[] => {
  if (!Array.isArray(value)) return [];
  const list: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const normalized = sanitizeText(item, maxItemLength);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    list.push(normalized);
    if (list.length >= maxItems) break;
  }
  return list;
};

const errorResponse = (error: unknown, fallbackMessage: string) => {
  if (error instanceof NewsletterFeatureError) {
    return json({ error: error.message }, error.statusCode);
  }

  console.error(fallbackMessage, error);
  return json({ error: fallbackMessage }, 500);
};

const htmlErrorResponse = (error: unknown, fallbackMessage: string) => {
  if (error instanceof NewsletterFeatureError) {
    return html(`<h1>${error.message}</h1>`, error.statusCode);
  }

  console.error(fallbackMessage, error);
  return html(`<h1>${fallbackMessage}</h1>`, 500);
};

const withWarningPayload = <T extends Record<string, unknown>>(payload: T, warnings: string[]) => (
  warnings.length > 0
    ? { ...payload, warning: warnings.join(' '), warnings }
    : payload
);

const isOneClickUnsubscribePost = (request: Request, token: string) => {
  if (!token) return false;
  const contentType = request.headers.get('content-type')?.toLowerCase() || '';
  return contentType.includes('application/x-www-form-urlencoded')
    || contentType.includes('text/plain')
    || contentType.includes('multipart/form-data')
    || contentType.length === 0;
};

const subscribeHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const settings = await loadNewsletterRuntimeSettings();
    if (!settings.enabled) {
      return json({ error: 'Newsletter is disabled' }, 403);
    }

    const payload = await request.json().catch(() => ({}));
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit({
      key: `newsletter:subscribe:${ip}`,
      limit: 10,
      windowMs: 10 * 60 * 1000
    });
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: 'Too many subscription attempts. Please try again later.' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimit.retryAfterSec)
        }
      });
    }

    const authenticatedUser = await getAuthenticatedUser(request);
    const result = await subscribeNewsletter({
      settings,
      email: normalizeEmail(payload.email),
      source: sanitizeText(payload.source, 80) || 'form',
      consent: toBoolean(payload.consent),
      authenticatedUser
    });

    return json(result);
  } catch (error) {
    return errorResponse(error, 'Failed to subscribe');
  }
};

const confirmHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    const settings = await loadNewsletterRuntimeSettings();
    if (!settings.enabled) {
      return html('<h1>Newsletter is disabled</h1>', 403);
    }

    const url = new URL(request.url);
    const email = normalizeEmail(url.searchParams.get('email') ?? '');
    const token = sanitizeText(url.searchParams.get('token') ?? '', 120);
    const result = await confirmNewsletterSubscription({
      settings,
      email,
      token
    });

    return html(
      `<!doctype html><html><head><meta charset="utf-8"><title>Subscription Confirmed</title></head><body style="font-family:system-ui,sans-serif;padding:24px;"><h1>Subscription confirmed</h1><p>You are now subscribed to updates from ${result.siteTitle}.</p><p><a href="${result.siteUrl}">Return to site</a></p></body></html>`
    );
  } catch (error) {
    return htmlErrorResponse(error, 'Confirmation link is invalid or expired.');
  }
};

const unsubscribeHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET' && request.method !== 'POST') return methodNotAllowed();

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      await unsubscribeNewsletterSubscription({
        token: sanitizeText(url.searchParams.get('token') ?? '', 4096),
        source: 'unsubscribe-link'
      });

      return html(
        '<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head><body style="font-family:system-ui,sans-serif;padding:24px;"><h1>Unsubscribed</h1><p>You will no longer receive newsletter updates from this site.</p></body></html>'
      );
    }

    const url = new URL(request.url);
    const tokenFromUrl = sanitizeText(url.searchParams.get('token') ?? '', 4096);
    if (isOneClickUnsubscribePost(request, tokenFromUrl)) {
      await unsubscribeNewsletterSubscription({
        token: tokenFromUrl,
        source: 'one-click'
      });
      return empty(200);
    }

    const payload = await request.json().catch(() => ({}));
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit({
      key: `newsletter:unsubscribe:${ip}`,
      limit: 20,
      windowMs: 10 * 60 * 1000
    });
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: 'Too many unsubscribe attempts. Please try again later.' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimit.retryAfterSec)
        }
      });
    }

    const authenticatedUser = await getAuthenticatedUser(request);
    await unsubscribeNewsletterSubscription({
      token: sanitizeText(payload.token, 4096),
      email: normalizeEmail(payload.email),
      source: 'unsubscribe',
      authenticatedUser
    });

    return json({ success: true });
  } catch (error) {
    if (request.method === 'GET') {
      return htmlErrorResponse(error, 'Failed to unsubscribe');
    }
    return errorResponse(error, 'Failed to unsubscribe');
  }
};

const statusHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return json({ error: 'Authentication required' }, 401);
    }

    const url = new URL(request.url);
    const requestedEmail = normalizeEmail(url.searchParams.get('email') ?? user.email);
    const isAdmin = user.role === 'admin';
    if (!isAdmin && requestedEmail !== normalizeEmail(user.email)) {
      return json({ error: 'Forbidden' }, 403);
    }

    if (!EMAIL_RE.test(requestedEmail)) {
      return json({ subscribed: false });
    }

    const subscribed = await getNewsletterSubscriptionStatus(requestedEmail);
    return json({ subscribed });
  } catch {
    return json({ subscribed: false });
  }
};

const metaHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    const settings = await loadNewsletterRuntimeSettings();
    return json(toPublicNewsletterMeta(settings));
  } catch (error) {
    return errorResponse(error, 'Failed to load newsletter settings');
  }
};

const adminStatusHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    await requireAuthor(request);
    const settings = await loadNewsletterRuntimeSettings();
    const [subscribers, campaigns, recentCampaigns] = await Promise.all([
      settings.enabled ? getNewsletterSubscriberSummary() : Promise.resolve({
        total: 0,
        pending: 0,
        subscribed: 0,
        unsubscribed: 0
      }),
      settings.enabled ? getNewsletterCampaignSummary() : Promise.resolve({
        total: 0,
        draft: 0,
        sending: 0,
        completed: 0,
        partial: 0,
        failed: 0
      }),
      settings.enabled ? listRecentNewsletterCampaigns() : Promise.resolve([])
    ]);

    return json(
      buildNewsletterAdminStatus({
        settings,
        subscribers,
        campaigns,
        recentCampaigns
      })
    );
  } catch (error) {
    if (error instanceof NewsletterFeatureError) {
      return json({ error: error.message }, error.statusCode);
    }
    return json({ error: 'Author access required' }, 403);
  }
};

const listHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    await requireAdmin(request);
    const { subscribers, summary } = await listNewsletterSubscribers();
    return json({
      subscribers,
      summary
    });
  } catch (error) {
    if (error instanceof NewsletterFeatureError) {
      return json({ error: error.message }, error.statusCode);
    }
    return json({ error: 'Admin access required' }, 403);
  }
};

const articlesHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    await requireAuthor(request);
    const settings = await loadNewsletterRuntimeSettings();
    if (!settings.enabled) return json({ error: 'Newsletter is disabled' }, 403);

    const articles = await loadCampaignArticles(settings.siteUrl);
    return json({ articles });
  } catch (error) {
    return errorResponse(error, 'Failed to load campaign articles');
  }
};

const previewPostHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    await requireAuthor(request);
    const settings = await loadNewsletterRuntimeSettings();
    if (!settings.enabled) return json({ error: 'Newsletter is disabled' }, 403);

    const payload = await request.json().catch(() => ({}));
    const post = await resolveCampaignPostPayload(payload, settings.siteUrl);
    const message = buildPostMessage(settings, 'preview@example.com', {
      title: post.title,
      excerpt: post.excerpt,
      url: post.url
    });

    return json({
      subject: message.subject,
      html: message.html,
      provider: settings.provider
    });
  } catch (error) {
    return errorResponse(error, 'Failed to build campaign preview');
  }
};

const previewCampaignHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    await requireAuthor(request);
    const settings = await loadNewsletterRuntimeSettings();
    if (!settings.enabled) return json({ error: 'Newsletter is disabled' }, 403);

    const payload = await request.json().catch(() => ({}));
    const articleIds = dedupeStringList(payload.articleIds, 12, 64);
    const articles = await resolveCampaignArticles(settings.siteUrl, articleIds);
    const message = buildCampaignMessage(settings, 'preview@example.com', {
      subject: sanitizeText(payload.subject, 220),
      introHtml: sanitizeText(payload.introHtml, 20_000),
      templateHtml: sanitizeText(payload.templateHtml, 80_000),
      articles
    });

    return json({
      subject: message.subject,
      html: message.html,
      provider: settings.provider,
      articlesCount: articles.length
    });
  } catch (error) {
    return errorResponse(error, 'Failed to build custom campaign preview');
  }
};

const sendTestPostHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    await requireAuthor(request);
    const settings = await loadNewsletterRuntimeSettings();
    if (!settings.enabled) return json({ error: 'Newsletter is disabled' }, 403);

    const payload = await request.json().catch(() => ({}));
    const email = normalizeEmail(payload.email);
    if (!EMAIL_RE.test(email)) {
      return json({ error: 'Valid test email is required' }, 400);
    }

    const post = await resolveCampaignPostPayload(payload, settings.siteUrl);
    const message = buildPostMessage(settings, email, {
      title: post.title,
      excerpt: post.excerpt,
      url: post.url
    });
    const result = await sendNewsletterMessage(settings, message);

    return json({
      success: true,
      provider: result.provider,
      messageId: result.messageId
    });
  } catch (error) {
    return errorResponse(error, 'Failed to send test email');
  }
};

const sendTestCampaignHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    await requireAuthor(request);
    const settings = await loadNewsletterRuntimeSettings();
    if (!settings.enabled) return json({ error: 'Newsletter is disabled' }, 403);

    const payload = await request.json().catch(() => ({}));
    const email = normalizeEmail(payload.email);
    if (!EMAIL_RE.test(email)) {
      return json({ error: 'Valid test email is required' }, 400);
    }

    const articles = await resolveCampaignArticles(
      settings.siteUrl,
      dedupeStringList(payload.articleIds, 12, 64)
    );
    const message = buildCampaignMessage(settings, email, {
      subject: sanitizeText(payload.subject, 220),
      introHtml: sanitizeText(payload.introHtml, 20_000),
      templateHtml: sanitizeText(payload.templateHtml, 80_000),
      articles
    });
    const result = await sendNewsletterMessage(settings, message);

    return json({
      success: true,
      provider: result.provider,
      messageId: result.messageId
    });
  } catch (error) {
    return errorResponse(error, 'Failed to send campaign test email');
  }
};

const sendPostHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const user = await requireAuthor(request);
    const settings = await loadNewsletterRuntimeSettings();
    if (!settings.enabled) return json({ error: 'Newsletter is disabled' }, 403);

    const payload = await request.json().catch(() => ({}));
    const postId = sanitizeText(payload.postId, 64);
    if (!postId) return json({ error: 'postId is required' }, 400);

    const post = await resolveCampaignPostPayload({ postId }, settings.siteUrl);
    if (post.status !== 'published') {
      return json({ error: 'Only published posts can be sent to subscribers.' }, 400);
    }

    const recipients = await loadNewsletterRecipients(settings.maxRecipientsPerCampaign);
    const result = await sendAuditedNewsletterCampaign({
      settings,
      recipients,
      createdBy: user.id,
      postId: post.postId,
      templateKey: 'new_post',
      buildMessage: (recipientEmail) =>
        buildPostMessage(settings, recipientEmail, {
          title: post.title,
          excerpt: post.excerpt,
          url: post.url
        })
    });

    return json(withWarningPayload(result, result.warnings));
  } catch (error) {
    return errorResponse(error, 'Failed to send newsletter campaign');
  }
};

const sendCampaignHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const user = await requireAuthor(request);
    const settings = await loadNewsletterRuntimeSettings();
    if (!settings.enabled) return json({ error: 'Newsletter is disabled' }, 403);

    const payload = await request.json().catch(() => ({}));
    const articles = await resolveCampaignArticles(
      settings.siteUrl,
      dedupeStringList(payload.articleIds, 12, 64)
    );
    const subject = sanitizeText(payload.subject, 220);
    const introHtml = sanitizeText(payload.introHtml, 20_000);
    const templateHtml = sanitizeText(payload.templateHtml, 80_000);
    const recipients = await loadNewsletterRecipients(settings.maxRecipientsPerCampaign);
    const result = await sendAuditedNewsletterCampaign({
      settings,
      recipients,
      createdBy: user.id,
      postId: null,
      templateKey: 'custom_campaign',
      buildMessage: (recipientEmail) =>
        buildCampaignMessage(settings, recipientEmail, {
          subject,
          introHtml,
          templateHtml,
          articles
        })
    });

    return json(withWarningPayload(result, result.warnings));
  } catch (error) {
    return errorResponse(error, 'Failed to send custom campaign');
  }
};

export const NEWSLETTER_FEATURE_API: FeatureApiModule = {
  handlers: {
    subscribe: subscribeHandler,
    confirm: confirmHandler,
    unsubscribe: unsubscribeHandler,
    status: statusHandler,
    meta: metaHandler,
    'admin-status': adminStatusHandler,
    list: listHandler,
    articles: articlesHandler,
    'preview-post': previewPostHandler,
    'preview-campaign': previewCampaignHandler,
    'send-test-post': sendTestPostHandler,
    'send-test-campaign': sendTestCampaignHandler,
    'send-post': sendPostHandler,
    'send-campaign': sendCampaignHandler
  }
};
