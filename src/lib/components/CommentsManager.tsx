import React, { useEffect, useMemo, useState } from 'react';
import { buildArticlePostPath } from '@/lib/routing/articles';
import { AdminLoadingState } from '@/lib/components/admin/ListingPrimitives';

type CommentStatus = 'pending' | 'approved' | 'rejected';

type CommentItem = {
  id: string;
  postId: string;
  authorName: string;
  authorEmail: string;
  content: string;
  status: CommentStatus;
  createdAt: string;
  post?: {
    title?: string;
    slug?: string;
  } | null;
};

type StatusFilter = 'all' | CommentStatus;
type CommentsManagerProps = {
  articleBasePath: string;
  articlePermalinkStyle: 'segment' | 'wordpress';
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function CommentsManager({ articleBasePath, articlePermalinkStyle }: CommentsManagerProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');

  const loadComments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/features/comments/queue');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to load comments');
      }
      const payload = await response.json();
      setComments(Array.isArray(payload.comments) ? payload.comments : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadComments();
  }, []);

  const metrics = useMemo(() => {
    const pending = comments.filter((item) => item.status === 'pending').length;
    const approved = comments.filter((item) => item.status === 'approved').length;
    const rejected = comments.filter((item) => item.status === 'rejected').length;
    return {
      total: comments.length,
      pending,
      approved,
      rejected
    };
  }, [comments]);

  const filteredComments = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    return comments.filter((item) => {
      if (filter !== 'all' && item.status !== filter) return false;
      if (!normalizedQuery) return true;

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
  }, [comments, filter, search]);

  const updateStatus = async (id: string, status: CommentStatus) => {
    try {
      setBusyId(id);
      setError(null);
      const response = await fetch('/api/features/comments/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to update comment');
      }
      setComments((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update comment');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-semibold">{metrics.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-warning">{metrics.pending}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved</p>
          <p className="mt-1 text-2xl font-semibold text-success">{metrics.approved}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Rejected</p>
          <p className="mt-1 text-2xl font-semibold text-destructive">{metrics.rejected}</p>
        </div>
      </div>

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
          <button type="button" className="btn btn-outline ml-auto" onClick={() => void loadComments()} disabled={loading}>
            Refresh
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
    </div>
  );
}
