import { randomUUID } from 'node:crypto';
import { getAuthenticatedUser, requireAdmin, requireAuthor } from '@/lib/auth/auth-helpers';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { getClientIp } from '@/lib/security/request-guards';
import { supabaseAdmin } from '@/lib/supabase';
import { getSiteContentRouting } from '@/lib/site-config';
import type { FeatureApiHandler, FeatureApiModule } from '../types.js';
import { buildArticlePostPath } from '@/lib/routing/articles.js';
import {
  buildCampaignMessage,
  buildConfirmationMessage,
  buildPostMessage,
  buildSubscriptionMessage,
  EMAIL_RE,
  getNewsletterSubscriptionStatus,
  loadNewsletterRuntimeSettings,
  normalizeEmail,
  sendNewsletterMessage,
  stripHtml,
  syncNewsletterSubscription
} from './lib/service.js';

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
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

type CampaignPostPayload = {
  postId?: string;
  title: string;
  excerpt: string;
  url: string;
  status?: string;
};

type CampaignArticle = {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  imageUrl?: string;
};

const resolveCampaignPostPayload = async (
  payload: Record<string, any>,
  siteUrl: string
): Promise<CampaignPostPayload> => {
  const contentRouting = await getSiteContentRouting();
  const articleRouting = {
    basePath: contentRouting.articleBasePath,
    permalinkStyle: contentRouting.articlePermalinkStyle
  };
  const postId = sanitizeText(payload.postId, 64);
  if (postId) {
    const { data, error } = await supabaseAdmin
      .from('posts')
      .select('id, title, excerpt, slug, content, status, published_at, updated_at')
      .eq('id', postId)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      throw new Error('Post not found.');
    }

    const slug = sanitizeText(data.slug, 255);
    const excerpt = sanitizeText(data.excerpt, 500) || stripHtml(sanitizeText(data.content, 20_000)).slice(0, 280);
    const postPath = slug
      ? buildArticlePostPath(slug, data.published_at || data.updated_at || null, articleRouting)
      : '/';
    const postUrl = slug ? `${siteUrl}${postPath}` : siteUrl;
    return {
      postId: data.id,
      title: sanitizeText(data.title, 200),
      excerpt,
      url: postUrl,
      status: sanitizeText(data.status, 40)
    };
  }

  const title = sanitizeText(payload.title, 200);
  const excerpt = sanitizeText(payload.excerpt, 500) || stripHtml(sanitizeText(payload.content, 20_000)).slice(0, 280);
  const slug = sanitizeText(payload.slug, 255).replace(/^\//, '');
  if (!title) {
    throw new Error('Post title is required.');
  }
  return {
    title,
    excerpt,
    url: slug
      ? `${siteUrl}${buildArticlePostPath(slug, null, articleRouting)}`
      : siteUrl
  };
};

const loadCampaignArticles = async (siteUrl: string): Promise<CampaignArticle[]> => {
  const contentRouting = await getSiteContentRouting();
  const articleRouting = {
    basePath: contentRouting.articleBasePath,
    permalinkStyle: contentRouting.articlePermalinkStyle
  };

  const { data, error } = await supabaseAdmin
    .from('posts')
    .select('id, title, excerpt, slug, content, published_at, updated_at, featured_image_id')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);
  if (error) {
    throw new Error('Failed to load published articles.');
  }

  const posts = Array.isArray(data) ? data : [];
  const imageIds = [...new Set(posts.map((post: any) => post.featured_image_id).filter(Boolean))];
  let imageMap = new Map<string, string>();
  if (imageIds.length > 0) {
    const { data: imageRows } = await (supabaseAdmin as any)
      .from('media_assets')
      .select('id, url')
      .in('id', imageIds);
    imageMap = new Map((imageRows || []).map((row: any) => [row.id, row.url]));
  }

  return posts.map((post: any) => {
    const slug = sanitizeText(post.slug, 255);
    const path = slug
      ? buildArticlePostPath(slug, post.published_at || post.updated_at || null, articleRouting)
      : '/';
    return {
      id: post.id,
      title: sanitizeText(post.title, 200),
      excerpt: sanitizeText(post.excerpt, 500) || stripHtml(sanitizeText(post.content, 20_000)).slice(0, 280),
      url: `${siteUrl}${path}`,
      imageUrl: post.featured_image_id ? imageMap.get(post.featured_image_id) : undefined
    };
  });
};

const resolveCampaignArticles = async (
  siteUrl: string,
  articleIds: string[]
): Promise<CampaignArticle[]> => {
  if (articleIds.length === 0) {
    throw new Error('Select at least one article card.');
  }
  const available = await loadCampaignArticles(siteUrl);
  const byId = new Map(available.map((article) => [article.id, article]));
  const resolved = articleIds
    .map((id) => byId.get(id))
    .filter((entry): entry is CampaignArticle => Boolean(entry));
  if (resolved.length === 0) {
    throw new Error('No valid published articles were selected.');
  }
  return resolved;
};

const subscribeHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const settings = await loadNewsletterRuntimeSettings();
    if (!settings.enabled) {
      return json({ error: 'Newsletter is disabled' }, 403);
    }

    const payload = await request.json().catch(() => ({}));
    const email = normalizeEmail(payload.email);
    const source = sanitizeText(payload.source, 80) || 'form';
    const consent = toBoolean(payload.consent);
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

    if (!EMAIL_RE.test(email)) {
      return json({ error: 'Valid email is required' }, 400);
    }
    if (settings.requireConsentCheckbox && !consent) {
      return json({ error: 'Explicit consent is required before subscribing.' }, 400);
    }

    const { data: previousSubscriber } = await supabaseAdmin
      .from('newsletter_subscribers')
      .select('status')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (previousSubscriber?.status === 'subscribed') {
      return json({ success: true, alreadySubscribed: true });
    }

    const authenticatedUser = await getAuthenticatedUser(request);
    const authUserId = authenticatedUser && normalizeEmail(authenticatedUser.email) === email
      ? authenticatedUser.id
      : undefined;

    if (settings.requireDoubleOptIn) {
      const token = randomUUID();
      await syncNewsletterSubscription({
        authUserId,
        email,
        source,
        optedIn: true,
        status: 'pending',
        confirmationToken: token,
        consent
      });
      const confirmation = buildConfirmationMessage(settings, email, token);
      await sendNewsletterMessage(settings, confirmation);
      return json({ success: true, pendingConfirmation: true });
    }

    await syncNewsletterSubscription({
      authUserId,
      email,
      source,
      optedIn: true,
      status: 'subscribed',
      consent
    });

    if (settings.sendWelcomeEmail && previousSubscriber?.status !== 'subscribed') {
      const welcome = buildSubscriptionMessage(settings, email);
      await sendNewsletterMessage(settings, welcome);
    }

    return json({ success: true, pendingConfirmation: false });
  } catch (error) {
    console.error('Newsletter subscribe failed:', error);
    return json({ error: 'Failed to subscribe' }, 500);
  }
};

const confirmHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  const settings = await loadNewsletterRuntimeSettings();
  if (!settings.enabled) {
    return new Response('<h1>Newsletter is disabled</h1>', { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const url = new URL(request.url);
  const email = normalizeEmail(url.searchParams.get('email') ?? '');
  const token = sanitizeText(url.searchParams.get('token') ?? '', 120);
  if (!EMAIL_RE.test(email) || !token) {
    return new Response('<h1>Invalid confirmation link</h1>', { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const { data: subscriber, error: lookupError } = await (supabaseAdmin as any)
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('email', email)
    .eq('confirmation_token', token)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    if (/confirmation_token/i.test(String(lookupError.message || ''))) {
      return new Response('<h1>Newsletter schema is outdated</h1><p>Run the latest newsletter feature migration and try again.</p>', {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    return new Response('<h1>Confirmation link is invalid or expired.</h1>', { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  if (!subscriber) {
    return new Response('<h1>Confirmation link is invalid or expired.</h1>', { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (subscriber.status !== 'subscribed') {
    await (supabaseAdmin as any)
      .from('newsletter_subscribers')
      .update({
        status: 'subscribed',
        confirmation_token: null,
        confirmed_at: new Date().toISOString(),
        unsubscribed_at: null
      })
      .eq('id', subscriber.id);

    if (settings.sendWelcomeEmail) {
      try {
        const welcome = buildSubscriptionMessage(settings, email);
        await sendNewsletterMessage(settings, welcome);
      } catch (error) {
        console.error('Newsletter welcome-after-confirm failed:', error);
      }
    }
  }

  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Subscription Confirmed</title></head><body style="font-family:system-ui,sans-serif;padding:24px;"><h1>Subscription confirmed</h1><p>You are now subscribed to updates from ${settings.siteTitle}.</p><p><a href="${settings.siteUrl}">Return to site</a></p></body></html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
};

const unsubscribeHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const payload = await request.json().catch(() => ({}));
    const email = normalizeEmail(payload.email);
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

    if (!EMAIL_RE.test(email)) {
      return json({ error: 'Valid email is required' }, 400);
    }

    await syncNewsletterSubscription({
      email,
      source: 'unsubscribe',
      optedIn: false
    });

    return json({ success: true });
  } catch {
    return json({ error: 'Failed to unsubscribe' }, 500);
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
  const settings = await loadNewsletterRuntimeSettings();
  return json({
    enabled: settings.enabled,
    provider: settings.provider,
    requireConsentCheckbox: settings.requireConsentCheckbox,
    consentLabel: settings.consentLabel,
    requireDoubleOptIn: settings.requireDoubleOptIn,
    signupFooterEnabled: settings.signupFooterEnabled,
    signupModalEnabled: settings.signupModalEnabled,
    signupModalDelaySeconds: settings.signupModalDelaySeconds
  });
};

const listHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    await requireAdmin(request);

    const { data, error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .select('id, email, status, source, created_at, unsubscribed_at, confirmed_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      return json({ error: 'Failed to load subscribers' }, 500);
    }

    return json({
      subscribers: data || []
    });
  } catch {
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
    return json({ error: error instanceof Error ? error.message : 'Failed to load campaign articles' }, 400);
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
    return json({ error: error instanceof Error ? error.message : 'Failed to build campaign preview' }, 400);
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
    const subject = sanitizeText(payload.subject, 220);
    const introHtml = sanitizeText(payload.introHtml, 20_000);
    const templateHtml = sanitizeText(payload.templateHtml, 80_000);
    const articles = await resolveCampaignArticles(settings.siteUrl, articleIds);
    const message = buildCampaignMessage(settings, 'preview@example.com', {
      subject,
      introHtml,
      templateHtml,
      articles
    });

    return json({
      subject: message.subject,
      html: message.html,
      provider: settings.provider,
      articlesCount: articles.length
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Failed to build custom campaign preview' }, 400);
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
    return json({ error: error instanceof Error ? error.message : 'Failed to send test email' }, 400);
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

    const subject = sanitizeText(payload.subject, 220);
    const introHtml = sanitizeText(payload.introHtml, 20_000);
    const templateHtml = sanitizeText(payload.templateHtml, 80_000);
    const articleIds = dedupeStringList(payload.articleIds, 12, 64);
    const articles = await resolveCampaignArticles(settings.siteUrl, articleIds);

    const message = buildCampaignMessage(settings, email, {
      subject,
      introHtml,
      templateHtml,
      articles
    });
    const result = await sendNewsletterMessage(settings, message);

    return json({
      success: true,
      provider: result.provider,
      messageId: result.messageId
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Failed to send campaign test email' }, 400);
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

    const { data: recipients, error: recipientsError } = await supabaseAdmin
      .from('newsletter_subscribers')
      .select('id, email')
      .eq('status', 'subscribed')
      .order('created_at', { ascending: true })
      .limit(settings.maxRecipientsPerCampaign);

    if (recipientsError) {
      return json({ error: 'Failed to load newsletter subscribers' }, 500);
    }

    const recipientList = recipients || [];
    if (recipientList.length === 0) {
      return json({ success: true, delivered: 0, failed: 0, recipients: 0 });
    }

    const sampleMessage = buildPostMessage(settings, normalizeEmail(recipientList[0].email), {
      title: post.title,
      excerpt: post.excerpt,
      url: post.url
    });
    const { data: campaign } = await (supabaseAdmin as any)
      .from('newsletter_campaigns')
      .insert({
        post_id: post.postId,
        template_key: 'new_post',
        subject: sampleMessage.subject,
        body_html: sampleMessage.html,
        provider: settings.provider,
        status: 'sending',
        recipients_count: recipientList.length,
        created_by: user.id,
        started_at: new Date().toISOString()
      })
      .select('id')
      .limit(1)
      .maybeSingle();

    const deliveryRows: Array<Record<string, any>> = [];
    let delivered = 0;
    let failed = 0;

    for (const recipient of recipientList) {
      const email = normalizeEmail(recipient.email);
      const message = buildPostMessage(settings, email, {
        title: post.title,
        excerpt: post.excerpt,
        url: post.url
      });

      try {
        const result = await sendNewsletterMessage(settings, message);
        delivered += 1;
        deliveryRows.push({
          campaign_id: campaign?.id ?? null,
          subscriber_id: recipient.id,
          email,
          status: 'delivered',
          provider_message_id: result.messageId,
          sent_at: new Date().toISOString()
        });
      } catch (deliveryError) {
        failed += 1;
        deliveryRows.push({
          campaign_id: campaign?.id ?? null,
          subscriber_id: recipient.id,
          email,
          status: 'failed',
          error: deliveryError instanceof Error ? deliveryError.message : 'Delivery failed'
        });
      }
    }

    if (deliveryRows.length > 0 && campaign?.id) {
      await (supabaseAdmin as any).from('newsletter_deliveries').insert(deliveryRows);
      await (supabaseAdmin as any)
        .from('newsletter_campaigns')
        .update({
          status: failed > 0 ? (delivered > 0 ? 'partial' : 'failed') : 'completed',
          delivered_count: delivered,
          failed_count: failed,
          completed_at: new Date().toISOString()
        })
        .eq('id', campaign.id);
    }

    return json({
      success: true,
      recipients: recipientList.length,
      delivered,
      failed
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Failed to send newsletter campaign' }, 400);
  }
};

const sendCampaignHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const user = await requireAuthor(request);
    const settings = await loadNewsletterRuntimeSettings();
    if (!settings.enabled) return json({ error: 'Newsletter is disabled' }, 403);

    const payload = await request.json().catch(() => ({}));
    const subject = sanitizeText(payload.subject, 220);
    const introHtml = sanitizeText(payload.introHtml, 20_000);
    const templateHtml = sanitizeText(payload.templateHtml, 80_000);
    const articleIds = dedupeStringList(payload.articleIds, 12, 64);
    const articles = await resolveCampaignArticles(settings.siteUrl, articleIds);

    const { data: recipients, error: recipientsError } = await supabaseAdmin
      .from('newsletter_subscribers')
      .select('id, email')
      .eq('status', 'subscribed')
      .order('created_at', { ascending: true })
      .limit(settings.maxRecipientsPerCampaign);

    if (recipientsError) {
      return json({ error: 'Failed to load newsletter subscribers' }, 500);
    }

    const recipientList = recipients || [];
    if (recipientList.length === 0) {
      return json({ success: true, delivered: 0, failed: 0, recipients: 0 });
    }

    const sampleMessage = buildCampaignMessage(settings, normalizeEmail(recipientList[0].email), {
      subject,
      introHtml,
      templateHtml,
      articles
    });
    const { data: campaign } = await (supabaseAdmin as any)
      .from('newsletter_campaigns')
      .insert({
        post_id: null,
        template_key: 'custom_campaign',
        subject: sampleMessage.subject,
        body_html: sampleMessage.html,
        provider: settings.provider,
        status: 'sending',
        recipients_count: recipientList.length,
        created_by: user.id,
        started_at: new Date().toISOString()
      })
      .select('id')
      .limit(1)
      .maybeSingle();

    const deliveryRows: Array<Record<string, any>> = [];
    let delivered = 0;
    let failed = 0;

    for (const recipient of recipientList) {
      const email = normalizeEmail(recipient.email);
      const message = buildCampaignMessage(settings, email, {
        subject,
        introHtml,
        templateHtml,
        articles
      });

      try {
        const result = await sendNewsletterMessage(settings, message);
        delivered += 1;
        deliveryRows.push({
          campaign_id: campaign?.id ?? null,
          subscriber_id: recipient.id,
          email,
          status: 'delivered',
          provider_message_id: result.messageId,
          sent_at: new Date().toISOString()
        });
      } catch (deliveryError) {
        failed += 1;
        deliveryRows.push({
          campaign_id: campaign?.id ?? null,
          subscriber_id: recipient.id,
          email,
          status: 'failed',
          error: deliveryError instanceof Error ? deliveryError.message : 'Delivery failed'
        });
      }
    }

    if (deliveryRows.length > 0 && campaign?.id) {
      await (supabaseAdmin as any).from('newsletter_deliveries').insert(deliveryRows);
      await (supabaseAdmin as any)
        .from('newsletter_campaigns')
        .update({
          status: failed > 0 ? (delivered > 0 ? 'partial' : 'failed') : 'completed',
          delivered_count: delivered,
          failed_count: failed,
          completed_at: new Date().toISOString()
        })
        .eq('id', campaign.id);
    }

    return json({
      success: true,
      recipients: recipientList.length,
      delivered,
      failed
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Failed to send custom campaign' }, 400);
  }
};

export const NEWSLETTER_FEATURE_API: FeatureApiModule = {
  handlers: {
    subscribe: subscribeHandler,
    confirm: confirmHandler,
    unsubscribe: unsubscribeHandler,
    status: statusHandler,
    meta: metaHandler,
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
