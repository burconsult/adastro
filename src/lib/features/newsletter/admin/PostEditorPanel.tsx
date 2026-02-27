import React, { useMemo, useState } from 'react';
import type { PostEditorExtensionProps } from '../../types.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';

type PreviewPayload = {
  subject: string;
  html: string;
  provider: string;
};

const excerptFromContent = (content: string) => {
  if (!content) return '';
  const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.slice(0, 220);
};

export const NewsletterPostEditorPanel: React.FC<PostEditorExtensionProps> = ({
  post,
  formData,
  notify
}) => {
  const [busy, setBusy] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postId = post?.id;
  const postStatus = post?.status ?? 'draft';
  const canSendToSubscribers = Boolean(postId && post?.status === 'published');

  const draftPayload = useMemo(
    () => ({
      postId: postId || undefined,
      title: formData.title,
      excerpt: formData.excerpt || excerptFromContent(formData.content),
      slug: post?.slug,
      content: formData.content
    }),
    [formData.content, formData.excerpt, formData.title, post?.slug, postId]
  );

  const requestJson = async (url: string, body: Record<string, any>) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Newsletter request failed');
    }
    return payload;
  };

  const loadPreview = async () => {
    const payload = await requestJson('/api/features/newsletter/preview-post', draftPayload);
    setPreview({
      subject: payload.subject,
      html: payload.html,
      provider: payload.provider
    });
    setPreviewOpen(true);
  };

  const sendTest = async () => {
    await requestJson('/api/features/newsletter/send-test-post', {
      ...draftPayload,
      email: testEmail
    });
    notify('Newsletter post test email sent.', 'success');
  };

  const sendToSubscribers = async () => {
    if (!postId) return;
    const payload = await requestJson('/api/features/newsletter/send-post', { postId });
    notify(`Post campaign sent: ${payload.delivered ?? 0} delivered, ${payload.failed ?? 0} failed.`, 'success');
  };

  const runAction = async (action: () => Promise<void>, fallbackError: string) => {
    try {
      setBusy(true);
      setError(null);
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : fallbackError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4 space-y-3">
      <div>
        <h4 className="font-semibold">Newsletter Post Update</h4>
        <p className="text-xs text-muted-foreground">
          Quick post announcement for subscribers. Use <a className="underline" href="/admin/features/newsletter">Features → Newsletter</a> for custom campaigns.
        </p>
      </div>

      {!postId && (
        <p className="text-xs text-muted-foreground">
          Save the post first to enable full newsletter sending.
        </p>
      )}

      {postId && postStatus !== 'published' && (
        <p className="text-xs text-muted-foreground">
          Publish this post before sending to all subscribers.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-outline h-8 px-3 text-xs"
          onClick={() => void runAction(loadPreview, 'Failed to load preview')}
          disabled={busy}
        >
          Preview Email
        </button>
        <button
          type="button"
          className="btn btn-primary h-8 px-3 text-xs"
          onClick={() => void runAction(sendToSubscribers, 'Failed to send newsletter campaign')}
          disabled={busy || !canSendToSubscribers}
        >
          Send To Subscribers
        </button>
      </div>

      <div className="space-y-2 rounded-md border border-border/70 bg-background/70 p-3">
        <label className="text-xs font-medium text-foreground" htmlFor="newsletter-test-email">
          Send test email
        </label>
        <input
          id="newsletter-test-email"
          type="email"
          className="w-full rounded-md border border-input px-3 py-2 text-sm"
          placeholder="you@example.com"
          value={testEmail}
          onChange={(event) => setTestEmail(event.target.value)}
        />
        <button
          type="button"
          className="btn btn-outline h-8 px-3 text-xs"
          onClick={() => void runAction(sendTest, 'Failed to send test email')}
          disabled={busy || !testEmail.trim()}
        >
          Send Test
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.subject || 'Newsletter preview'}</DialogTitle>
            <DialogDescription>
              Provider: {preview?.provider || 'unknown'}
            </DialogDescription>
          </DialogHeader>
          <div
            className="max-h-[65vh] overflow-auto rounded-md border border-border/70 bg-background p-4"
            dangerouslySetInnerHTML={{ __html: preview?.html || '' }}
          />
          <DialogFooter>
            <button type="button" className="btn btn-outline" onClick={() => setPreviewOpen(false)}>
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
