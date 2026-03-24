import React, { useEffect, useMemo, useState } from 'react';

import { AdminLoadingState } from '@/lib/components/admin/ListingPrimitives';
import { buildArticlePostPath } from '@/lib/routing/articles';

import type { CommentQueueFilter, CommentQueueItem, CommentQueueSummary, CommentStatus } from '../lib/types.js';

type CommentsModerationQueueProps = {
  articleBasePath: string;
  articlePermalinkStyle: 'segment' | 'wordpress';
};

type CommentsStatusPayload = {
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

const EMPTY_SUMMARY: CommentQueueSummary = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0
};

const requestJson = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as any)?.error || 'Request failed');
  }
  return payload;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export function CommentsModerationQueue({
  articleBasePath,
  articlePermalinkStyle
}: CommentsModerationQueueProps) {
  const [comments, setComments] = useState<CommentQueueItem[]>([]);
  const [summary, setSummary] = useState<CommentQueueSummary>(EMPTY_SUMMARY);
  const [statusInfo, setStatusInfo] = useState<CommentsStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CommentQueueFilter>('pending');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadQueue = async () => {
      try {
        setLoading(true);
        setError(null);

        const [statusPayload, queuePayload] = await Promise.all([
          requestJson('/api/features/comments/status'),
          requestJson(`/api/features/comments/queue?status=${encodeURIComponent(filter)}&limit=200`)
        ]);

        if (cancelled) return;

        setStatusInfo(statusPayload as CommentsStatusPayload);
        setSummary((statusPayload as CommentsStatusPayload).summary || EMPTY_SUMMARY);
        setComments(Array.isArray(queuePayload?.comments) ? queuePayload.comments as CommentQueueItem[] : []);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load comments');
          setComments([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadQueue();
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const filteredComments = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    if (!normalizedQuery) return comments;

    return comments.filter((item) => {
      const haystack = [
        item.authorName,
        item.authorEmail,
        item.content,
        item.post?.title || '',
        item.post?.slug || ''
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [comments, search]);

  const refreshCurrentFilter = async () => {
    const [statusPayload, queuePayload] = await Promise.all([
      requestJson('/api/features/comments/status'),
      requestJson(`/api/features/comments/queue?status=${encodeURIComponent(filter)}&limit=200`)
    ]);

    setStatusInfo(statusPayload as CommentsStatusPayload);
    setSummary((statusPayload as CommentsStatusPayload).summary || EMPTY_SUMMARY);
    setComments(Array.isArray(queuePayload?.comments) ? queuePayload.comments as CommentQueueItem[] : []);
  };

  const updateStatus = async (id: string, status: CommentStatus) => {
    try {
      setBusyId(id);
      setError(null);

      await requestJson('/api/features/comments/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });

      await refreshCurrentFilter();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update comment');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-warning">{summary.pending}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved</p>
          <p className="mt-1 text-2xl font-semibold text-success">{summary.approved}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Rejected</p>
          <p className="mt-1 text-2xl font-semibold text-destructive">{summary.rejected}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="card p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilter('pending')}
            >
              Pending
            </button>
            <button
              type="button"
              className={`btn ${filter === 'approved' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilter('approved')}
            >
              Approved
            </button>
            <button
              type="button"
              className={`btn ${filter === 'rejected' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilter('rejected')}
            >
              Rejected
            </button>
            <button
              type="button"
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
          </div>

          <label className="block">
            <span className="sr-only">Search comments</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by author, email, post, or text..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <AdminLoadingState label="Loading comments..." className="px-0 py-6" />
          ) : filteredComments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments match this filter.</p>
          ) : (
            <ul className="space-y-3">
              {filteredComments.map((item) => (
                <li key={item.id} className="rounded-lg border border-border/70 bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{item.authorName}</span>
                    <span>·</span>
                    <span>{item.authorEmail}</span>
                    <span>·</span>
                    <span>{formatDate(item.createdAt)}</span>
                    <span>·</span>
                    <span className="uppercase tracking-wide">{item.status}</span>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{item.content}</p>

                  <div className="mt-2 text-xs text-muted-foreground">
                    {item.post?.slug ? (
                      <a
                        href={buildArticlePostPath(item.post.slug, null, {
                          basePath: articleBasePath,
                          permalinkStyle: articlePermalinkStyle
                        })}
                        className="hover:text-foreground underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.post?.title || item.post.slug}
                      </a>
                    ) : (
                      <span>{item.post?.title || 'Post unavailable'}</span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-primary h-8 px-3 text-xs"
                      onClick={() => void updateStatus(item.id, 'approved')}
                      disabled={busyId === item.id || item.status === 'approved'}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline h-8 px-3 text-xs"
                      onClick={() => void updateStatus(item.id, 'rejected')}
                      disabled={busyId === item.id || item.status === 'rejected'}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline h-8 px-3 text-xs"
                      onClick={() => void updateStatus(item.id, 'pending')}
                      disabled={busyId === item.id || item.status === 'pending'}
                    >
                      Mark Pending
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4 space-y-3">
          <h3 className="text-base font-semibold">Moderation Policy</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Manual moderation: <span className="font-medium text-foreground">{statusInfo?.moderation ? 'Enabled' : 'Disabled'}</span>
            </p>
            <p>
              Signed-in comments only: <span className="font-medium text-foreground">{statusInfo?.authenticatedOnly ? 'Enabled' : 'Disabled'}</span>
            </p>
            <p>
              Max links before hold: <span className="font-medium text-foreground">{statusInfo?.spam.maxLinks ?? '—'}</span>
            </p>
            <p>
              Minimum seconds before submit: <span className="font-medium text-foreground">{statusInfo?.spam.minSecondsToSubmit ?? '—'}</span>
            </p>
            <p>
              Blocked terms: <span className="font-medium text-foreground">{statusInfo?.spam.blockedTermsCount ?? 0}</span>
            </p>
            <p>
              reCAPTCHA: <span className="font-medium text-foreground">
                {statusInfo?.recaptcha.required
                  ? statusInfo.recaptcha.configured
                    ? `Active (min score ${statusInfo.recaptcha.minScore})`
                    : 'Required but not configured'
                  : 'Off'}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommentsModerationQueue;
