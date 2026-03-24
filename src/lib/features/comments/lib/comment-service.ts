import type { AuthUser } from '@/lib/auth/auth-helpers';
import { DEFAULT_LOCALE, normalizeLocaleCode } from '@/lib/i18n/locales';
import { verifyRecaptchaToken } from '@/lib/security/recaptcha';
import { supabaseAdmin } from '@/lib/supabase';

import type {
  CommentQueueFilter,
  CommentQueueItem,
  CommentQueueSummary,
  CommentStatus,
  CommentsAdminStatus,
  CommentsRuntimeConfig,
  PublicCommentItem
} from './types.js';
import { buildCommentsAdminStatus } from './config-service.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 200;
const MAX_CONTENT_LENGTH = 4000;

export class CommentsFeatureError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'CommentsFeatureError';
    this.statusCode = statusCode;
  }
}

const sanitizeText = (value: unknown, maxLength: number) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, maxLength);

const stripHtmlToPlainText = (value: string, preserveLineBreaks = false) => {
  const withoutScripts = value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ');

  const withLineBreaks = preserveLineBreaks
    ? withoutScripts
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\/(?:p|div|li|ul|ol|blockquote|h[1-6]|pre)\s*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '- ')
    : withoutScripts;

  const flattened = withLineBreaks
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r\n?/g, '\n');

  if (!preserveLineBreaks) {
    return flattened.replace(/\s+/g, ' ').trim();
  }

  return flattened
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const sanitizePlainText = (
  value: unknown,
  maxLength: number,
  options?: { preserveLineBreaks?: boolean }
) =>
  stripHtmlToPlainText(typeof value === 'string' ? value : '', options?.preserveLineBreaks)
    .slice(0, maxLength);

const normalizeEmail = (value: unknown) =>
  sanitizeText(value, MAX_EMAIL_LENGTH).toLowerCase();

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

  const authorName = sanitizePlainText(author?.name, MAX_NAME_LENGTH);
  if (authorName.length >= 2) {
    return authorName;
  }

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('full_name')
    .eq('auth_user_id', authUserId)
    .limit(1)
    .maybeSingle();

  const fullName = sanitizePlainText(profile?.full_name, MAX_NAME_LENGTH);
  if (fullName.length >= 2) {
    return fullName;
  }

  return fallbackAuthorNameFromEmail(email);
};

export const resolvePublishedPostId = async (input: {
  slug?: string;
  postId?: string;
  locale?: string;
}) => {
  const slug = sanitizeText(input.slug, 255);
  const postId = sanitizeText(input.postId, 64);
  const locale = normalizeLocaleCode(input.locale, DEFAULT_LOCALE);

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
    if (locale) {
      query = query.eq('locale', locale);
    }
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return null;
  }

  return data.id as string;
};

export const listApprovedComments = async (input: {
  slug?: string;
  postId?: string;
  locale?: string;
}): Promise<{ postFound: boolean; comments: PublicCommentItem[] }> => {
  const postId = await resolvePublishedPostId(input);
  if (!postId) {
    return { postFound: false, comments: [] };
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .select('id, author_name, content, created_at')
    .eq('post_id', postId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new CommentsFeatureError('Failed to load comments', 500);
  }

  return {
    postFound: true,
    comments: (data || []).map((item) => ({
      id: item.id,
      authorName: item.author_name,
      content: item.content,
      createdAt: item.created_at
    }))
  };
};

const countComments = async (status?: CommentStatus) => {
  let query = (supabaseAdmin as any)
    .from('comments')
    .select('id', { count: 'exact', head: true });

  if (status) {
    query = query.eq('status', status);
  }

  const { count, error } = await query;
  if (error) {
    throw new CommentsFeatureError('Failed to load comment summary', 500);
  }

  return typeof count === 'number' ? count : 0;
};

export const getCommentQueueSummary = async (): Promise<CommentQueueSummary> => {
  const [total, pending, approved, rejected] = await Promise.all([
    countComments(),
    countComments('pending'),
    countComments('approved'),
    countComments('rejected')
  ]);

  return {
    total,
    pending,
    approved,
    rejected
  };
};

export const getCommentsAdminStatus = async (
  config: CommentsRuntimeConfig
): Promise<CommentsAdminStatus> => {
  const summary = await getCommentQueueSummary();
  return buildCommentsAdminStatus(config, summary);
};

export const listCommentQueue = async (input: {
  status: CommentQueueFilter;
  limit: number;
  offset: number;
}) => {
  let query = (supabaseAdmin as any)
    .from('comments')
    .select('id, post_id, author_name, author_email, content, status, created_at, updated_at, posts:post_id (id, title, slug, locale)')
    .order('created_at', { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);

  if (input.status !== 'all') {
    query = query.eq('status', input.status);
  }

  const { data, error } = await query;
  if (error) {
    throw new CommentsFeatureError('Failed to load comment queue', 500);
  }

  const summary = await getCommentQueueSummary();
  const comments: CommentQueueItem[] = Array.isArray(data)
    ? data.map((row: any) => ({
        id: row.id,
        postId: row.post_id,
        authorName: row.author_name,
        authorEmail: row.author_email,
        content: row.content,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        post: row.posts
          ? {
              id: row.posts.id,
              title: row.posts.title,
              slug: row.posts.slug,
              locale: row.posts.locale
            }
          : null
      }))
    : [];

  return {
    status: input.status,
    limit: input.limit,
    offset: input.offset,
    count: comments.length,
    summary,
    comments
  };
};

export const updateCommentModerationStatus = async (input: {
  commentId: string;
  status: CommentStatus;
}) => {
  const { data, error } = await (supabaseAdmin as any)
    .from('comments')
    .update({ status: input.status })
    .eq('id', input.commentId)
    .select('id, post_id, status, updated_at')
    .maybeSingle();

  if (error) {
    throw new CommentsFeatureError('Failed to update comment status', 500);
  }
  if (!data) {
    throw new CommentsFeatureError(`Comment not found: ${input.commentId}`, 404);
  }

  return {
    id: data.id,
    postId: data.post_id,
    status: data.status as CommentStatus,
    updatedAt: data.updated_at
  };
};

export const submitComment = async (input: {
  slug?: string;
  postId?: string;
  locale?: string;
  authorName?: string;
  authorEmail?: string;
  content?: string;
  website?: string;
  recaptchaToken?: string;
  elapsedMs?: number;
  ip?: string;
  authenticatedUser?: AuthUser | null;
  config: CommentsRuntimeConfig;
}): Promise<{ id?: string; status: CommentStatus }> => {
  const postId = await resolvePublishedPostId({
    slug: input.slug,
    postId: input.postId,
    locale: input.locale
  });
  if (!postId) {
    throw new CommentsFeatureError('Post not found', 404);
  }

  let authorName = sanitizePlainText(input.authorName, MAX_NAME_LENGTH);
  let authorEmail = normalizeEmail(input.authorEmail);

  if (input.authenticatedUser) {
    const normalizedEmail = normalizeEmail(input.authenticatedUser.email);
    if (!EMAIL_RE.test(normalizedEmail)) {
      throw new CommentsFeatureError('Authenticated user email is invalid', 400);
    }

    authorEmail = normalizedEmail;
    authorName = await resolveAuthenticatedAuthorName(input.authenticatedUser.id, normalizedEmail);
  }

  const content = sanitizePlainText(input.content, MAX_CONTENT_LENGTH, { preserveLineBreaks: true });
  const website = sanitizeText(input.website, 200);

  if (!authorName || authorName.length < 2) {
    throw new CommentsFeatureError('Name is required', 400);
  }
  if (!EMAIL_RE.test(authorEmail)) {
    throw new CommentsFeatureError('Valid email is required', 400);
  }
  if (!content || content.length < 2) {
    throw new CommentsFeatureError('Comment content is required', 400);
  }

  if (website) {
    return { status: 'pending' };
  }

  if (
    Number.isFinite(input.elapsedMs)
    && Number(input.elapsedMs) < input.config.spam.minSecondsToSubmit * 1000
  ) {
    throw new CommentsFeatureError('Comment submitted too quickly. Please try again.', 400);
  }

  if (input.config.recaptcha.required && !input.config.recaptcha.configured) {
    throw new CommentsFeatureError(
      'Comment protection is enabled but not configured. Please contact the site admin.',
      503
    );
  }

  if (input.config.recaptcha.enabled) {
    const verification = await verifyRecaptchaToken({
      token: sanitizeText(input.recaptchaToken, 4096),
      secretKey: input.config.recaptcha.secretKey,
      expectedAction: 'comment_submit',
      minScore: input.config.recaptcha.minScore,
      remoteIp: input.ip
    });
    if (!verification.ok) {
      throw new CommentsFeatureError('Anti-spam verification failed. Please try again.', 400);
    }
  }

  const normalizedContent = content.toLowerCase();
  const linkCount = (content.match(/(?:https?:\/\/|www\.)/gi) || []).length;
  const hasBlockedTerm = input.config.spam.blockedTerms.some((term) => normalizedContent.includes(term));
  const shouldModerate = input.config.moderation
    || linkCount > input.config.spam.maxLinks
    || hasBlockedTerm;
  const status: CommentStatus = shouldModerate ? 'pending' : 'approved';

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
    throw new CommentsFeatureError('Failed to submit comment', 500);
  }

  return {
    id: data.id,
    status: data.status as CommentStatus
  };
};
