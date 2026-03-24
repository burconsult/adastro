import * as z from 'zod/v4';

import type { FeatureMcpExtension } from '../types.js';
import { loadCommentsRuntimeConfig } from './lib/config-service.js';
import { listCommentQueue as listCommentQueueItems, updateCommentModerationStatus } from './lib/comment-service.js';
import type { CommentStatus } from './lib/types.js';

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
  const config = await loadCommentsRuntimeConfig();
  if (!config.enabled) {
    throw new Error('Comments feature is disabled.');
  }
  return config;
};

const listCommentQueue = async (args: Record<string, unknown>) => {
  await assertCommentsEnabled();
  const input = parseArgs(queueArgsSchema, args);
  const status = input.status ?? 'pending';
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  return listCommentQueueItems({
    status,
    limit,
    offset
  });
};

const moderateComment = async (args: Record<string, unknown>) => {
  await assertCommentsEnabled();

  const input = parseArgs(moderateArgsSchema, args);
  return updateCommentModerationStatus({
    commentId: input.commentId,
    status: input.status as CommentStatus
  });
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
