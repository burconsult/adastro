import { getAuthenticatedUser, requireAdmin } from '@/lib/auth/auth-helpers';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { getClientIp } from '@/lib/security/request-guards';
import type { FeatureApiHandler, FeatureApiModule } from '../types.js';
import { loadCommentsRuntimeConfig, toPublicCommentsStatus } from './lib/config-service.js';
import {
  CommentsFeatureError,
  getCommentsAdminStatus,
  listApprovedComments,
  listCommentQueue,
  submitComment,
  updateCommentModerationStatus
} from './lib/comment-service.js';
import {
  COMMENT_QUEUE_FILTER_VALUES,
  COMMENT_STATUS_VALUES,
  type CommentQueueFilter,
  type CommentStatus
} from './lib/types.js';

const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 200;
const MAX_CONTENT_LENGTH = 4000;

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const methodNotAllowed = () => json({ error: 'Method not allowed' }, 405);

const sanitizeText = (value: unknown, maxLength: number) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, maxLength);

const errorResponse = (error: unknown, fallbackMessage: string) => {
  if (error instanceof CommentsFeatureError) {
    return json({ error: error.message }, error.statusCode);
  }

  console.error(fallbackMessage, error);
  return json({ error: fallbackMessage }, 500);
};

const listHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    const config = await loadCommentsRuntimeConfig();
    if (!config.enabled) {
      return json({ enabled: false, comments: [], recaptcha: { enabled: false } });
    }

    const url = new URL(request.url);
    const slug = sanitizeText(url.searchParams.get('slug'), 255);
    const postIdInput = sanitizeText(url.searchParams.get('postId'), 64);
    const locale = sanitizeText(url.searchParams.get('locale'), 12);

    if (!slug && !postIdInput) {
      return json({ error: 'postId or slug is required' }, 400);
    }
    const publicStatus = toPublicCommentsStatus(config);
    const { comments } = await listApprovedComments({ slug, postId: postIdInput, locale });

    return json({
      ...publicStatus,
      comments
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load comments');
  }
};

const submitHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const config = await loadCommentsRuntimeConfig();
    if (!config.enabled) {
      return json({ error: 'Comments are disabled' }, 403);
    }

    const payload = await request.json().catch(() => ({}));
    const slug = sanitizeText(payload.slug, 255);
    const postIdInput = sanitizeText(payload.postId, 64);
    const locale = sanitizeText(payload.locale, 12);
    const providedAuthorName = sanitizeText(payload.authorName, MAX_NAME_LENGTH);
    const providedAuthorEmail = sanitizeText(payload.authorEmail, MAX_EMAIL_LENGTH).toLowerCase();
    const content = sanitizeText(payload.content, MAX_CONTENT_LENGTH);
    const website = sanitizeText(payload.website, 200);
    const recaptchaToken = sanitizeText(payload.recaptchaToken, 4096);
    const elapsedMs = Number(payload.elapsedMs);
    const authenticatedUser = await getAuthenticatedUser(request);
    const ip = getClientIp(request);

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
    if (config.authenticatedOnly && !authenticatedUser) {
      return json({ error: 'Sign in to comment.' }, 401);
    }
    const result = await submitComment({
      slug,
      postId: postIdInput,
      locale,
      authorName: providedAuthorName,
      authorEmail: providedAuthorEmail,
      content,
      website,
      recaptchaToken,
      elapsedMs,
      ip,
      authenticatedUser,
      config
    });

    return json({
      success: true,
      id: result.id,
      status: result.status
    });
  } catch (error) {
    return errorResponse(error, 'Failed to submit comment');
  }
};

const queueHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    await requireAdmin(request);
    const config = await loadCommentsRuntimeConfig();
    if (!config.enabled) {
      return json({ error: 'Comments are disabled' }, 403);
    }
    const url = new URL(request.url);
    const statusParam = sanitizeText(url.searchParams.get('status'), 20);
    const limitParam = Number(url.searchParams.get('limit'));
    const offsetParam = Number(url.searchParams.get('offset'));
    const status: CommentQueueFilter = COMMENT_QUEUE_FILTER_VALUES.includes(statusParam as CommentQueueFilter)
      ? (statusParam as CommentQueueFilter)
      : 'all';
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(200, Math.round(limitParam))) : 200;
    const offset = Number.isFinite(offsetParam) ? Math.max(0, Math.round(offsetParam)) : 0;
    const queue = await listCommentQueue({ status, limit, offset });

    return json({
      ...queue
    });
  } catch (error) {
    if (error instanceof CommentsFeatureError) {
      return json({ error: error.message }, error.statusCode);
    }
    return json({ error: 'Admin access required' }, 403);
  }
};

const moderateHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    await requireAdmin(request);
    const config = await loadCommentsRuntimeConfig();
    if (!config.enabled) {
      return json({ error: 'Comments are disabled' }, 403);
    }
    const payload = await request.json().catch(() => ({}));
    const commentId = sanitizeText(payload.id, 64);
    const status = sanitizeText(payload.status, 20) as CommentStatus;

    if (!commentId) return json({ error: 'Comment id is required' }, 400);
    if (!COMMENT_STATUS_VALUES.includes(status)) {
      return json({ error: 'Invalid status' }, 400);
    }

    await updateCommentModerationStatus({ commentId, status });

    return json({ success: true });
  } catch (error) {
    if (error instanceof CommentsFeatureError) {
      return json({ error: error.message }, error.statusCode);
    }
    return json({ error: 'Admin access required' }, 403);
  }
};

const statusHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    await requireAdmin(request);
    const config = await loadCommentsRuntimeConfig();
    if (!config.enabled) {
      return json({ error: 'Comments are disabled' }, 403);
    }

    return json(await getCommentsAdminStatus(config));
  } catch (error) {
    if (error instanceof CommentsFeatureError) {
      return json({ error: error.message }, error.statusCode);
    }
    return json({ error: 'Admin access required' }, 403);
  }
};

export const COMMENTS_FEATURE_API: FeatureApiModule = {
  handlers: {
    list: listHandler,
    submit: submitHandler,
    queue: queueHandler,
    moderate: moderateHandler,
    status: statusHandler
  }
};
