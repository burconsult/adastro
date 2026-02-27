import React, { useEffect, useMemo, useState } from 'react';
import { normalizeFeatureFlag } from '@/lib/features/flags';

type CommentItem = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
};

type AuthenticatedViewer = {
  name: string;
  email: string;
};

type RecaptchaConfig = {
  enabled: boolean;
  required?: boolean;
  configured?: boolean;
  siteKey?: string;
};

interface CommentsSectionProps {
  slug: string;
}

type GrecaptchaApi = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: GrecaptchaApi;
    __adastroRecaptchaLoadPromise?: Promise<void>;
  }
}

const loadRecaptchaScript = (siteKey: string): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.grecaptcha) {
    return Promise.resolve();
  }

  if (window.__adastroRecaptchaLoadPromise) {
    return window.__adastroRecaptchaLoadPromise;
  }

  window.__adastroRecaptchaLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-adastro-recaptcha="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load anti-spam script.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.adastroRecaptcha = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load anti-spam script.'));
    document.head.appendChild(script);
  });

  return window.__adastroRecaptchaLoadPromise;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const fallbackAuthorNameFromEmail = (email: string) => {
  const localPart = email.split('@')[0] || '';
  const normalized = localPart.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length < 2) return 'Member';
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export const CommentsSection: React.FC<CommentsSectionProps> = ({ slug }) => {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [viewer, setViewer] = useState<AuthenticatedViewer | null>(null);
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const [authenticatedOnly, setAuthenticatedOnly] = useState(false);
  const [recaptcha, setRecaptcha] = useState<RecaptchaConfig>({ enabled: false });
  const [honeypot, setHoneypot] = useState('');
  const [form, setForm] = useState({ authorName: '', authorEmail: '', content: '' });
  const [startedAt] = useState(() => Date.now());

  const hasComments = comments.length > 0;
  const isAuthenticated = Boolean(viewer?.email);
  const commentCountLabel = useMemo(() => `${comments.length} comment${comments.length === 1 ? '' : 's'}`, [comments.length]);

  const loadComments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/features/comments/list?slug=${encodeURIComponent(slug)}`);
      if (!response.ok) {
        throw new Error('Failed to load comments');
      }
      const payload = await response.json();
      setEnabled(normalizeFeatureFlag(payload.enabled, false));
      setRecaptcha({
        enabled: normalizeFeatureFlag(payload?.recaptcha?.enabled, false),
        required: normalizeFeatureFlag(payload?.recaptcha?.required, false),
        configured: normalizeFeatureFlag(payload?.recaptcha?.configured, true),
        siteKey: typeof payload?.recaptcha?.siteKey === 'string' ? payload.recaptcha.siteKey : undefined
      });
      setAuthenticatedOnly(normalizeFeatureFlag(payload?.authenticatedOnly, false));
      setComments(Array.isArray(payload.comments) ? payload.comments : []);
    } catch (loadError) {
      setEnabled(false);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadComments();
  }, [slug]);

  useEffect(() => {
    const loadViewer = async () => {
      try {
        const response = await fetch('/api/profile?optional=1');
        if (response.status === 401) {
          setViewer(null);
          setViewerLoaded(true);
          return;
        }
        if (!response.ok) {
          setViewerLoaded(true);
          return;
        }

        const payload = await response.json().catch(() => ({}));
        const email = typeof payload?.user?.email === 'string'
          ? payload.user.email.trim().toLowerCase()
          : '';
        if (!email) {
          setViewerLoaded(true);
          return;
        }

        const fullName = typeof payload?.profile?.fullName === 'string'
          ? payload.profile.fullName.trim()
          : '';
        const name = (fullName.length >= 2 ? fullName : fallbackAuthorNameFromEmail(email)).slice(0, 120);

        setViewer({ name, email });
        setForm((prev) => ({
          ...prev,
          authorName: name,
          authorEmail: email
        }));
      } catch (_error) {
        // No-op: comments still work in guest mode when profile lookup fails.
      } finally {
        setViewerLoaded(true);
      }
    };

    void loadViewer();
  }, []);

  useEffect(() => {
    if (!recaptcha.enabled || !recaptcha.siteKey) return;
    void loadRecaptchaScript(recaptcha.siteKey);
  }, [recaptcha.enabled, recaptcha.siteKey]);

  const commentsTemporarilyClosed = recaptcha.required === true && recaptcha.configured === false;
  const guestCommentsBlocked = authenticatedOnly && viewerLoaded && !isAuthenticated;

  const resolveRecaptchaToken = async (): Promise<string | undefined> => {
    if (!recaptcha.enabled || !recaptcha.siteKey) {
      return undefined;
    }

    await loadRecaptchaScript(recaptcha.siteKey);
    const grecaptcha = window.grecaptcha;
    if (!grecaptcha) {
      throw new Error('Anti-spam service failed to load. Please refresh and try again.');
    }

    await new Promise<void>((resolve) => grecaptcha.ready(resolve));
    return grecaptcha.execute(recaptcha.siteKey, { action: 'comment_submit' });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (guestCommentsBlocked) {
      setError('Sign in to comment.');
      return;
    }
    if (commentsTemporarilyClosed) {
      setError('Comments are temporarily unavailable while anti-spam settings are being configured.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setMessage(null);
      const recaptchaToken = await resolveRecaptchaToken();

      const response = await fetch('/api/features/comments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          authorName: viewer?.name ?? form.authorName,
          authorEmail: viewer?.email ?? form.authorEmail,
          content: form.content,
          recaptchaToken,
          website: honeypot,
          elapsedMs: Date.now() - startedAt
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to submit comment');
      }

      setForm(() => ({
        authorName: viewer?.name ?? '',
        authorEmail: viewer?.email ?? '',
        content: ''
      }));
      if (payload.status === 'approved') {
        setMessage('Comment posted.');
        await loadComments();
      } else {
        setMessage('Comment submitted and pending moderation.');
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit comment');
    } finally {
      setSubmitting(false);
    }
  };

  if (enabled !== true) {
    return null;
  }

  return (
    <section className="mt-12 border-t border-border pt-8" aria-labelledby="comments-heading">
      <div className="mb-6 flex items-baseline justify-between gap-3">
        <h2 id="comments-heading" className="text-2xl font-semibold text-foreground">
          Comments
        </h2>
        {!loading && <span className="text-sm text-muted-foreground">{commentCountLabel}</span>}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          {message}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading comments…</p>
      ) : hasComments ? (
        <ol className="mb-8 space-y-4">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-foreground">{comment.authorName}</span>
                <span className="text-muted-foreground">·</span>
                <time className="text-muted-foreground">{formatDate(comment.createdAt)}</time>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{comment.content}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mb-8 text-sm text-muted-foreground">No comments yet. Be the first to respond.</p>
      )}

      {commentsTemporarilyClosed && (
        <div className="mb-4 rounded-md border border-amber-300/50 bg-amber-100/60 px-4 py-3 text-sm text-amber-900">
          Comments are temporarily unavailable while anti-spam checks are being configured.
        </div>
      )}

      {authenticatedOnly && !isAuthenticated && (
        <div className="mb-4 rounded-md border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {viewerLoaded ? (
            <>
              Sign in to comment.{' '}
              <a
                href={`/auth/login?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`}
                className="font-medium text-foreground underline underline-offset-2"
              >
                Open login
              </a>
            </>
          ) : (
            'Checking sign-in status...'
          )}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className={`mb-8 grid gap-3 rounded-2xl border border-border/80 bg-background/70 p-4 ${isAuthenticated ? '' : 'sm:grid-cols-2'} ${guestCommentsBlocked ? 'opacity-70' : ''}`}
      >
        {isAuthenticated ? (
          <p className="text-sm text-muted-foreground">
            Commenting as <span className="font-medium text-foreground">{viewer?.name}</span> ({viewer?.email})
          </p>
        ) : (
          <>
            <div>
              <label htmlFor="comment-name" className="mb-1 block text-sm font-medium text-foreground">Name</label>
              <input
                id="comment-name"
                value={form.authorName}
                onChange={(event) => setForm((prev) => ({ ...prev, authorName: event.target.value }))}
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
                maxLength={120}
                disabled={guestCommentsBlocked}
                required
              />
            </div>
            <div>
              <label htmlFor="comment-email" className="mb-1 block text-sm font-medium text-foreground">Email</label>
              <input
                id="comment-email"
                type="email"
                value={form.authorEmail}
                onChange={(event) => setForm((prev) => ({ ...prev, authorEmail: event.target.value }))}
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
                maxLength={200}
                disabled={guestCommentsBlocked}
                required
              />
            </div>
          </>
        )}
        <div className={isAuthenticated ? '' : 'sm:col-span-2'}>
          <label htmlFor="comment-content" className="mb-1 block text-sm font-medium text-foreground">Comment</label>
          <textarea
            id="comment-content"
            value={form.content}
            onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
            className="min-h-[110px] w-full rounded-md border border-input px-3 py-2 text-sm"
            maxLength={4000}
            disabled={guestCommentsBlocked}
            required
          />
        </div>
        <div className="hidden">
          <label htmlFor="comment-website">Website</label>
          <input
            id="comment-website"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
            autoComplete="off"
            tabIndex={-1}
          />
        </div>
        <div className={isAuthenticated ? 'flex justify-end' : 'sm:col-span-2 flex justify-end'}>
          <button
            type="submit"
            className="btn bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
            disabled={submitting || commentsTemporarilyClosed || guestCommentsBlocked}
          >
            {submitting ? 'Posting…' : 'Post comment'}
          </button>
        </div>
      </form>
    </section>
  );
};

export default CommentsSection;
