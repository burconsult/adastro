import { getAuthenticatedUser, requireAdmin } from '@/lib/auth/auth-helpers';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { getClientIp } from '@/lib/security/request-guards';
import { getFeatureRecaptchaConfig, verifyRecaptchaToken } from '@/lib/security/recaptcha';
import { normalizeFeatureFlag } from '@/lib/features/flags';
import { SettingsService } from '@/lib/services/settings-service';
import { supabaseAdmin } from '@/lib/supabase';
import type { FeatureApiHandler, FeatureApiModule } from '../types.js';

const settingsService = new SettingsService();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 200;
const MAX_CONTENT_LENGTH = 4000;

type CommentStatus = 'pending' | 'approved' | 'rejected';

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const methodNotAllowed = () => json({ error: 'Method not allowed' }, 405);

const sanitizeText = (value: unknown, maxLength: number) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, maxLength);

const fallbackAuthorNameFromEmail = (email: string) => {
  const localPart = email.split('@')[0] || '';
  const normalized = localPart.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length < 2) {
    return 'Member';
  }

  return normalized
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .slice(0, MAX_NAME_LENGTH);
};

const resolveAuthenticatedAuthorName = async (authUserId: string, email: string) => {
  const { data: author } = await supabaseAdmin
    .from('authors')
    .select('name')
    .eq('auth_user_id', authUserId)
    .limit(1)
    .maybeSingle();

  const authorName = sanitizeText(author?.name, MAX_NAME_LENGTH);
  if (authorName.length >= 2) {
    return authorName;
  }

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('full_name')
    .eq('auth_user_id', authUserId)
    .limit(1)
    .maybeSingle();

  const fullName = sanitizeText(profile?.full_name, MAX_NAME_LENGTH);
  if (fullName.length >= 2) {
    return fullName;
  }

  return fallbackAuthorNameFromEmail(email);
};

const resolvePublishedPostId = async (input: { slug?: string; postId?: string }) => {
  const slug = sanitizeText(input.slug, 255);
  const postId = sanitizeText(input.postId, 64);

  if (!slug && !postId) {
    return null;
  }

  let query = supabaseAdmin
    .from('posts')
    .select('id, status')
    .eq('status', 'published')
    .limit(1);

  if (postId) {
    query = query.eq('id', postId);
  } else {
    query = query.eq('slug', slug);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return null;
  }

  return data.id as string;
};

const isCommentsEnabled = async () => {
  const enabled = await settingsService.getSetting('features.comments.enabled');
  return normalizeFeatureFlag(enabled, false);
};

const getSpamSettings = async () => {
  const settings = await settingsService.getSettings([
    'features.comments.maxLinks',
    'features.comments.minSecondsToSubmit',
    'features.comments.blockedTerms'
  ]);

  const maxLinksRaw = Number(settings['features.comments.maxLinks']);
  const minSecondsRaw = Number(settings['features.comments.minSecondsToSubmit']);
  const blockedTermsRaw = Array.isArray(settings['features.comments.blockedTerms'])
    ? settings['features.comments.blockedTerms']
    : [];

  return {
    maxLinks: Number.isFinite(maxLinksRaw) ? Math.max(0, Math.min(20, maxLinksRaw)) : 3,
    minSecondsToSubmit: Number.isFinite(minSecondsRaw) ? Math.max(0, Math.min(120, minSecondsRaw)) : 2,
    blockedTerms: blockedTermsRaw
      .map((term: unknown) => sanitizeText(term, 80).toLowerCase())
      .filter(Boolean)
  };
};

const shouldModerateComments = async () => {
  const enabled = await settingsService.getSetting('features.comments.moderation');
  return normalizeFeatureFlag(enabled, true);
};

const requiresAuthenticatedComments = async () => {
  const enabled = await settingsService.getSetting('features.comments.authenticatedOnly');
  return normalizeFeatureFlag(enabled, false);
};

const listHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    if (!(await isCommentsEnabled())) {
      return json({ enabled: false, comments: [], recaptcha: { enabled: false } });
    }

    const recaptcha = await getFeatureRecaptchaConfig({
      settingsService,
      featureSettingKey: 'features.comments.recaptcha.enabled'
    });
    const authenticatedOnly = await requiresAuthenticatedComments();

    const url = new URL(request.url);
    const slug = sanitizeText(url.searchParams.get('slug'), 255);
    const postIdInput = sanitizeText(url.searchParams.get('postId'), 64);

    if (!slug && !postIdInput) {
      return json({ error: 'postId or slug is required' }, 400);
    }
    const postId = await resolvePublishedPostId({ slug, postId: postIdInput });
    if (!postId) {
      return json({
        enabled: true,
        recaptcha: {
          enabled: recaptcha.enabled,
          required: recaptcha.required,
          configured: recaptcha.configured,
          minScore: recaptcha.minScore,
          siteKey: recaptcha.enabled ? recaptcha.siteKey : undefined
        },
        authenticatedOnly,
        comments: []
      });
    }

    const { data, error } = await supabaseAdmin
      .from('comments')
      .select('id, author_name, content, created_at')
      .eq('post_id', postId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return json({ error: 'Failed to load comments' }, 500);
    }

    return json({
      enabled: true,
      recaptcha: {
        enabled: recaptcha.enabled,
        required: recaptcha.required,
        configured: recaptcha.configured,
        minScore: recaptcha.minScore,
        siteKey: recaptcha.enabled ? recaptcha.siteKey : undefined
      },
      authenticatedOnly,
      comments: (data || []).map((item) => ({
        id: item.id,
        authorName: item.author_name,
        content: item.content,
        createdAt: item.created_at
      }))
    });
  } catch (error) {
    console.error('Comments list failed:', error);
    return json({ error: 'Failed to load comments' }, 500);
  }
};

const submitHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    if (!(await isCommentsEnabled())) {
      return json({ error: 'Comments are disabled' }, 403);
    }

    const payload = await request.json().catch(() => ({}));
    const slug = sanitizeText(payload.slug, 255);
    const postIdInput = sanitizeText(payload.postId, 64);
    const providedAuthorName = sanitizeText(payload.authorName, MAX_NAME_LENGTH);
    const providedAuthorEmail = sanitizeText(payload.authorEmail, MAX_EMAIL_LENGTH).toLowerCase();
    const content = sanitizeText(payload.content, MAX_CONTENT_LENGTH);
    const website = sanitizeText(payload.website, 200);
    const recaptchaToken = sanitizeText(payload.recaptchaToken, 4096);
    const elapsedMs = Number(payload.elapsedMs);
    const authenticatedUser = await getAuthenticatedUser(request);
    const ip = getClientIp(request);
    const authenticatedOnly = await requiresAuthenticatedComments();

    const rateLimit = checkRateLimit({
      key: authenticatedUser?.id
        ? `comments:submit:user:${authenticatedUser.id}`
        : `comments:submit:ip:${ip}`,
      limit: 8,
      windowMs: 5 * 60 * 1000
    });
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: 'Too many comments submitted. Try again in a few minutes.' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimit.retryAfterSec)
        }
      });
    }

    if (!slug && !postIdInput) {
      return json({ error: 'postId or slug is required' }, 400);
    }
    if (authenticatedOnly && !authenticatedUser) {
      return json({ error: 'Sign in to comment.' }, 401);
    }
    const postId = await resolvePublishedPostId({ slug, postId: postIdInput });
    if (!postId) {
      return json({ error: 'Post not found' }, 404);
    }

    let authorName = providedAuthorName;
    let authorEmail = providedAuthorEmail;

    if (authenticatedUser) {
      const normalizedEmail = sanitizeText(authenticatedUser.email, MAX_EMAIL_LENGTH).toLowerCase();
      if (!EMAIL_RE.test(normalizedEmail)) {
        return json({ error: 'Authenticated user email is invalid' }, 400);
      }

      authorEmail = normalizedEmail;
      authorName = await resolveAuthenticatedAuthorName(authenticatedUser.id, normalizedEmail);
    }

    if (!authorName || authorName.length < 2) {
      return json({ error: 'Name is required' }, 400);
    }
    if (!EMAIL_RE.test(authorEmail)) {
      return json({ error: 'Valid email is required' }, 400);
    }
    if (!content || content.length < 2) {
      return json({ error: 'Comment content is required' }, 400);
    }

    const spamSettings = await getSpamSettings();
    const recaptcha = await getFeatureRecaptchaConfig({
      settingsService,
      featureSettingKey: 'features.comments.recaptcha.enabled'
    });

    if (website) {
      return json({ success: true, status: 'pending' });
    }

    if (
      Number.isFinite(elapsedMs)
      && elapsedMs < spamSettings.minSecondsToSubmit * 1000
    ) {
      return json({ error: 'Comment submitted too quickly. Please try again.' }, 400);
    }
    if (recaptcha.required && !recaptcha.configured) {
      return json({ error: 'Comment protection is enabled but not configured. Please contact the site admin.' }, 503);
    }
    if (recaptcha.enabled) {
      const verification = await verifyRecaptchaToken({
        token: recaptchaToken,
        secretKey: recaptcha.secretKey,
        expectedAction: 'comment_submit',
        minScore: recaptcha.minScore,
        remoteIp: ip
      });
      if (!verification.ok) {
        return json({ error: 'Anti-spam verification failed. Please try again.' }, 400);
      }
    }

    const linkCount = (content.match(/(?:https?:\/\/|www\.)/gi) || []).length;
    const normalizedContent = content.toLowerCase();
    const hasBlockedTerm = spamSettings.blockedTerms.some((term) => normalizedContent.includes(term));

    const moderationEnabled = await shouldModerateComments();
    const status: CommentStatus = moderationEnabled || linkCount > spamSettings.maxLinks || hasBlockedTerm
      ? 'pending'
      : 'approved';

    const { data, error } = await supabaseAdmin
      .from('comments')
      .insert({
        post_id: postId,
        author_name: authorName,
        author_email: authorEmail,
        content,
        status
      })
      .select('id, status')
      .single();

    if (error || !data) {
      return json({ error: 'Failed to submit comment' }, 500);
    }

    return json({
      success: true,
      id: data.id,
      status: data.status
    });
  } catch (error) {
    console.error('Comment submit failed:', error);
    return json({ error: 'Failed to submit comment' }, 500);
  }
};

const queueHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    await requireAdmin(request);

    const { data, error } = await supabaseAdmin
      .from('comments')
      .select('id, post_id, author_name, author_email, content, status, created_at, posts:post_id (title, slug)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return json({ error: 'Failed to load comment queue' }, 500);
    }

    return json({
      comments: (data || []).map((item: any) => ({
        id: item.id,
        postId: item.post_id,
        authorName: item.author_name,
        authorEmail: item.author_email,
        content: item.content,
        status: item.status,
        createdAt: item.created_at,
        post: item.posts
          ? {
              title: item.posts.title,
              slug: item.posts.slug
            }
          : null
      }))
    });
  } catch (error) {
    return json({ error: 'Admin access required' }, 403);
  }
};

const moderateHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    await requireAdmin(request);
    const payload = await request.json().catch(() => ({}));
    const commentId = sanitizeText(payload.id, 64);
    const status = sanitizeText(payload.status, 20) as CommentStatus;

    if (!commentId) return json({ error: 'Comment id is required' }, 400);
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return json({ error: 'Invalid status' }, 400);
    }

    const { error } = await supabaseAdmin
      .from('comments')
      .update({ status })
      .eq('id', commentId);

    if (error) {
      return json({ error: 'Failed to update comment status' }, 500);
    }

    return json({ success: true });
  } catch (error) {
    return json({ error: 'Admin access required' }, 403);
  }
};

export const COMMENTS_FEATURE_API: FeatureApiModule = {
  handlers: {
    list: listHandler,
    submit: submitHandler,
    queue: queueHandler,
    moderate: moderateHandler
  }
};
