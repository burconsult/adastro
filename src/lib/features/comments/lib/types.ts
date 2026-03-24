export const COMMENT_STATUS_VALUES = ['pending', 'approved', 'rejected'] as const;
export const COMMENT_QUEUE_FILTER_VALUES = ['all', ...COMMENT_STATUS_VALUES] as const;

export type CommentStatus = (typeof COMMENT_STATUS_VALUES)[number];
export type CommentQueueFilter = (typeof COMMENT_QUEUE_FILTER_VALUES)[number];

export type PublicCommentItem = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
};

export type CommentQueueSummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

export type CommentQueueItem = {
  id: string;
  postId: string;
  authorName: string;
  authorEmail: string;
  content: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt?: string | null;
  post?: {
    id?: string;
    title?: string;
    slug?: string;
    locale?: string | null;
  } | null;
};

export type CommentsRuntimeConfig = {
  enabled: boolean;
  moderation: boolean;
  authenticatedOnly: boolean;
  spam: {
    maxLinks: number;
    minSecondsToSubmit: number;
    blockedTerms: string[];
  };
  recaptcha: {
    enabled: boolean;
    required: boolean;
    configured: boolean;
    minScore: number;
    siteKey: string;
    secretKey: string;
  };
};

export type CommentsAdminStatus = {
  enabled: boolean;
  moderation: boolean;
  authenticatedOnly: boolean;
  spam: {
    maxLinks: number;
    minSecondsToSubmit: number;
    blockedTermsCount: number;
  };
  recaptcha: {
    enabled: boolean;
    required: boolean;
    configured: boolean;
    minScore: number;
  };
  summary: CommentQueueSummary;
};
