import * as z from 'zod/v4';

import { SettingsService } from '@/lib/services/settings-service';
import { normalizeFeatureFlag } from '@/lib/features/flags';
import { supabaseAdmin } from '@/lib/supabase';

import type { FeatureMcpExtension } from '../types.js';

const settingsService = new SettingsService();

type CommentModerationStatus = 'pending' | 'approved' | 'rejected';

const queueArgsSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional()
}).strict();

const moderateArgsSchema = z.object({
  commentId: z.string().uuid(),
  status: z.enum(['pending', 'approved', 'rejected'])
}).strict();

const parseArgs = <T>(schema: z.ZodSchema<T>, args: Record<string, unknown>): T => {
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(issue?.message || 'Invalid tool arguments');
  }
  return parsed.data;
};

const assertCommentsEnabled = async () => {
  const enabled = await settingsService.getSetting('features.comments.enabled');
  if (!normalizeFeatureFlag(enabled, false)) {
    throw new Error('Comments feature is disabled.');
  }
};

const listCommentQueue = async (args: Record<string, unknown>) => {
  await assertCommentsEnabled();

  const input = parseArgs(queueArgsSchema, args);
  const status = input.status ?? 'pending';
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  let query = (supabaseAdmin as any)
    .from('comments')
    .select('id, post_id, author_name, author_email, content, status, created_at, updated_at, posts:post_id (id, title, slug, locale)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || 'Failed to load comment queue');
  }

  const items = Array.isArray(data)
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
    status,
    limit,
    offset,
    count: items.length,
    comments: items
  };
};

const moderateComment = async (args: Record<string, unknown>) => {
  await assertCommentsEnabled();

  const input = parseArgs(moderateArgsSchema, args);
  const nextStatus = input.status as CommentModerationStatus;

  const { data, error } = await (supabaseAdmin as any)
    .from('comments')
    .update({ status: nextStatus })
    .eq('id', input.commentId)
    .select('id, post_id, status, updated_at')
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to update comment status');
  }
  if (!data) {
    throw new Error(`Comment not found: ${input.commentId}`);
  }

  return {
    id: data.id,
    postId: data.post_id,
    status: data.status,
    updatedAt: data.updated_at
  };
};

export const COMMENTS_FEATURE_MCP_EXTENSION: FeatureMcpExtension = {
  getTools: () => [
    {
      name: 'comments_queue_list',
      title: 'List Comment Queue',
      description: 'List comments for moderation with status filter and pagination.',
      inputSchema: {
        status: z.enum(['pending', 'approved', 'rejected', 'all']).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional()
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      handler: listCommentQueue
    },
    {
      name: 'comments_moderate',
      title: 'Moderate Comment',
      description: 'Approve, reject, or return a comment to pending status.',
      inputSchema: {
        commentId: z.string().uuid(),
        status: z.enum(['pending', 'approved', 'rejected'])
      },
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
      handler: moderateComment
    }
  ]
};
