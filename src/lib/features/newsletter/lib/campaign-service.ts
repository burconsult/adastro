import { getSiteContentRouting } from '@/lib/site-config';
import { supabaseAdmin } from '@/lib/supabase';
import { buildArticlePostPath } from '@/lib/routing/articles.js';

import { stripHtml } from './template-service.js';
import type {
  CampaignArticle,
  CampaignPostPayload,
  NewsletterCampaignStatusItem,
  NewsletterCampaignSummary,
  NewsletterRecipient,
  NewsletterSubscriberSummary
} from './types.js';
import { NewsletterFeatureError } from './types.js';

const sanitizeText = (value: unknown, maxLength: number) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, maxLength);

const normalizeEmail = (value: unknown) =>
  sanitizeText(value, 200).toLowerCase();

const countRows = async (table: string, status?: string) => {
  let query = (supabaseAdmin as any)
    .from(table)
    .select('id', { count: 'exact', head: true });

  if (status) {
    query = query.eq('status', status);
  }

  const { count, error } = await query;
  if (error) {
    throw new NewsletterFeatureError(`Failed to load ${table} summary`, 500);
  }

  return typeof count === 'number' ? count : 0;
};

export const resolveCampaignPostPayload = async (
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
      throw new NewsletterFeatureError('Post not found.', 404);
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
    throw new NewsletterFeatureError('Post title is required.', 400);
  }

  return {
    title,
    excerpt,
    url: slug
      ? `${siteUrl}${buildArticlePostPath(slug, null, articleRouting)}`
      : siteUrl
  };
};

export const loadCampaignArticles = async (siteUrl: string): Promise<CampaignArticle[]> => {
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
    throw new NewsletterFeatureError('Failed to load published articles.', 500);
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

export const resolveCampaignArticles = async (
  siteUrl: string,
  articleIds: string[]
): Promise<CampaignArticle[]> => {
  if (articleIds.length === 0) {
    throw new NewsletterFeatureError('Select at least one article card.', 400);
  }

  const available = await loadCampaignArticles(siteUrl);
  const byId = new Map(available.map((article) => [article.id, article]));
  const resolved = articleIds
    .map((id) => byId.get(id))
    .filter((entry): entry is CampaignArticle => Boolean(entry));

  if (resolved.length === 0) {
    throw new NewsletterFeatureError('No valid published articles were selected.', 400);
  }

  return resolved;
};

export const loadNewsletterRecipients = async (
  limit: number
): Promise<NewsletterRecipient[]> => {
  const { data, error } = await supabaseAdmin
    .from('newsletter_subscribers')
    .select('id, email')
    .eq('status', 'subscribed')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new NewsletterFeatureError('Failed to load newsletter subscribers', 500);
  }

  return Array.isArray(data)
    ? data
        .map((recipient: any) => ({
          id: recipient.id,
          email: normalizeEmail(recipient.email)
        }))
        .filter((recipient) => Boolean(recipient.id) && Boolean(recipient.email))
    : [];
};

export const listNewsletterSubscribers = async (limit = 500) => {
  const { data, error } = await supabaseAdmin
    .from('newsletter_subscribers')
    .select('id, email, status, source, created_at, unsubscribed_at, confirmed_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new NewsletterFeatureError('Failed to load subscribers', 500);
  }

  const summary = await getNewsletterSubscriberSummary();

  return {
    subscribers: data || [],
    summary
  };
};

export const getNewsletterSubscriberSummary = async (): Promise<NewsletterSubscriberSummary> => {
  const [total, pending, subscribed, unsubscribed] = await Promise.all([
    countRows('newsletter_subscribers'),
    countRows('newsletter_subscribers', 'pending'),
    countRows('newsletter_subscribers', 'subscribed'),
    countRows('newsletter_subscribers', 'unsubscribed')
  ]);

  return {
    total,
    pending,
    subscribed,
    unsubscribed
  };
};

export const getNewsletterCampaignSummary = async (): Promise<NewsletterCampaignSummary> => {
  const [total, draft, sending, completed, partial, failed] = await Promise.all([
    countRows('newsletter_campaigns'),
    countRows('newsletter_campaigns', 'draft'),
    countRows('newsletter_campaigns', 'sending'),
    countRows('newsletter_campaigns', 'completed'),
    countRows('newsletter_campaigns', 'partial'),
    countRows('newsletter_campaigns', 'failed')
  ]);

  return {
    total,
    draft,
    sending,
    completed,
    partial,
    failed
  };
};

export const listRecentNewsletterCampaigns = async (
  limit = 5
): Promise<NewsletterCampaignStatusItem[]> => {
  const { data, error } = await (supabaseAdmin as any)
    .from('newsletter_campaigns')
    .select('id, template_key, subject, provider, status, recipients_count, delivered_count, failed_count, created_at, started_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new NewsletterFeatureError('Failed to load newsletter campaigns', 500);
  }

  return Array.isArray(data)
    ? data.map((campaign: any) => ({
        id: campaign.id,
        templateKey: campaign.template_key,
        subject: campaign.subject,
        provider: campaign.provider,
        status: campaign.status,
        recipientsCount: Number(campaign.recipients_count || 0),
        deliveredCount: Number(campaign.delivered_count || 0),
        failedCount: Number(campaign.failed_count || 0),
        createdAt: campaign.created_at,
        startedAt: campaign.started_at,
        completedAt: campaign.completed_at
      }))
    : [];
};
