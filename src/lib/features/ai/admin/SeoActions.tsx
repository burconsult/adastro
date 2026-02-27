import React, { useCallback, useEffect, useState } from 'react';
import { normalizeFeatureFlag } from '@/lib/features/flags';
import type { SEOMetadata } from '@/lib/types/index.js';
import type { SeoActionsProps } from '../../types.js';

const AI_SEO_TIMEOUT_MS = 60_000;

export const AiSeoActions: React.FC<SeoActionsProps> = ({
  metadata,
  setMetadata,
  postTitle,
  postExcerpt,
  postContent,
  postTags,
  notify,
  disableAutoGenerate
}) => {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const [settingsResponse, statusResponse] = await Promise.all([
          fetch('/api/admin/settings?keys=features.ai.enabled,features.ai.enableSeo,features.ai.defaultProvider.text'),
          fetch('/api/features/ai/status')
        ]);

        if (!settingsResponse.ok) {
          throw new Error('Failed to load AI settings');
        }

        const settings = await settingsResponse.json();
        const statusAvailable = statusResponse.ok;
        const status = statusAvailable ? await statusResponse.json() : null;
        const aiEnabled = normalizeFeatureFlag(settings['features.ai.enabled'], false);
        const seoEnabled = normalizeFeatureFlag(settings['features.ai.enableSeo'], true);
        const defaultProvider = settings['features.ai.defaultProvider.text'] || 'openai';
        const textProviders = Array.isArray(status?.textProviders) ? status.textProviders : [];
        const providerReady = textProviders.includes(defaultProvider) || !statusAvailable;

        if (!cancelled) {
          setEnabled(aiEnabled && seoEnabled && providerReady);
        }
      } catch (error) {
        if (!cancelled) {
          setEnabled(false);
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    try {
      setMessage(null);
      setBusy(true);
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), AI_SEO_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch('/api/features/ai/seo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: postTitle,
            excerpt: postExcerpt,
            content: postContent,
            tags: postTags
          }),
          signal: controller.signal
        });
      } finally {
        window.clearTimeout(timer);
      }
      if (!response.ok) {
        const responseClone = response.clone();
        const payload = await response.json().catch(async () => {
          const text = await responseClone.text().catch(() => '');
          return text ? { error: text } : null;
        });
        throw new Error(payload?.error || 'Failed to generate SEO metadata');
      }

      const payload = await response.json();
      const generated = payload?.seoMetadata;
      if (!generated) {
        throw new Error('AI did not return SEO metadata');
      }

      const nextMetadata: SEOMetadata = {
        ...metadata,
        ...generated,
        openGraph: {
          ...(metadata.openGraph ?? {}),
          ...(generated.openGraph ?? {})
        },
        twitterCard: {
          ...(metadata.twitterCard ?? {}),
          ...(generated.twitterCard ?? {})
        }
      };

      disableAutoGenerate();
      setMetadata(nextMetadata);
      setMessage('AI metadata generated. Review and adjust as needed.');
      notify('AI metadata generated.', 'success');
    } catch (error) {
      const errorMessage = error instanceof DOMException && error.name === 'AbortError'
        ? 'AI SEO request timed out. Please try again.'
        : error instanceof Error
          ? error.message
          : 'AI SEO generation failed';
      setMessage(errorMessage);
      notify(errorMessage, 'error');
    } finally {
      setBusy(false);
    }
  }, [
    disableAutoGenerate,
    metadata,
    notify,
    postContent,
    postExcerpt,
    postTags,
    postTitle,
    setMetadata
  ]);

  if (!ready || !enabled) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleGenerate}
        className="btn btn-outline"
        disabled={busy || !postTitle.trim()}
      >
        {busy ? 'Generating...' : 'Generate with AI'}
      </button>
      {message && (
        <span className="text-xs text-muted-foreground">{message}</span>
      )}
    </div>
  );
};
