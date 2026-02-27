import React, { useCallback, useEffect, useState } from 'react';
import { normalizeFeatureFlag } from '@/lib/features/flags';
import type { MediaLibraryExtensionProps } from '../../types.js';

const AI_IMAGE_TIMEOUT_MS = 120_000;

const normalizeOpenAiImageSize = (value?: string): string => {
  if (value === '1536x1024') return '1792x1024';
  if (value === '1024x1536') return '1024x1792';
  if (value === '1792x1024' || value === '1024x1792' || value === '1024x1024') {
    return value;
  }
  return '1024x1024';
};

export const AiMediaLibraryPanel: React.FC<MediaLibraryExtensionProps> = ({
  addAsset,
  selectAsset,
  setBanner,
  refreshStats
}) => {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [imageEnabled, setImageEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('');
  const [imageSize, setImageSize] = useState('1024x1024');
  const [imageAspectRatio, setImageAspectRatio] = useState('1:1');
  const [imageResolution, setImageResolution] = useState('1K');
  const [imageProvider, setImageProvider] = useState('openai');

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const [settingsResponse, statusResponse] = await Promise.all([
          fetch('/api/admin/settings?keys=features.ai.enabled,features.ai.enableImages,features.ai.imageSize,features.ai.imageAspectRatio,features.ai.imageResolution,features.ai.defaultProvider.image'),
          fetch('/api/features/ai/status')
        ]);

        if (!settingsResponse.ok) {
          throw new Error('Failed to load AI settings');
        }

        const settings = await settingsResponse.json();
        const statusAvailable = statusResponse.ok;
        const status = statusAvailable ? await statusResponse.json() : null;
        const aiSuiteEnabled = normalizeFeatureFlag(settings['features.ai.enabled'], false);
        const provider = settings['features.ai.defaultProvider.image'] || 'openai';
        const imageProviders = Array.isArray(status?.imageProviders) ? status.imageProviders : [];
        const enabled = aiSuiteEnabled
          && normalizeFeatureFlag(settings['features.ai.enableImages'], true)
          && (imageProviders.includes(provider) || !statusAvailable);

        if (cancelled) return;

        setAiEnabled(aiSuiteEnabled);
        setImageEnabled(enabled);
        setImageProvider(provider);
        setImageSize(normalizeOpenAiImageSize(settings['features.ai.imageSize'] || '1024x1024'));
        setImageAspectRatio(settings['features.ai.imageAspectRatio'] || '1:1');
        setImageResolution(settings['features.ai.imageResolution'] || '1K');
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to load AI settings', error);
          setAiEnabled(false);
          setImageEnabled(false);
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
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setMessage('Add a prompt to generate an image.');
      return;
    }

    if (!imageEnabled) {
      setMessage('AI image generation is disabled.');
      return;
    }

    try {
      setMessage('Generating image… This can take 30–90 seconds depending on provider load.');
      setBusy(true);
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), AI_IMAGE_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch('/api/features/ai/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: trimmedPrompt,
            style: style.trim() || undefined,
            size: imageSize,
            aspectRatio: imageAspectRatio,
            resolution: imageResolution
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
        throw new Error(payload?.error || 'Failed to generate image');
      }

      const payload = await response.json();
      const media = payload?.media;
      if (!media) {
        throw new Error('AI did not return a media asset');
      }

      addAsset(media);
      if (media?.id) {
        selectAsset(media.id);
      }
      refreshStats();
      setPrompt('');
      setMessage('AI image generated and added to your library.');
      setBanner({ type: 'success', message: 'AI image generated and added to your library.' });
    } catch (error) {
      const errorMessage = error instanceof DOMException && error.name === 'AbortError'
        ? 'AI image request timed out. Please try again.'
        : error instanceof Error
          ? error.message
          : 'AI image generation failed';
      setMessage(errorMessage);
      setBanner({ type: 'error', message: errorMessage });
    } finally {
      setBusy(false);
    }
  }, [
    addAsset,
    imageAspectRatio,
    imageEnabled,
    imageResolution,
    imageSize,
    prompt,
    refreshStats,
    selectAsset,
    setBanner,
    style
  ]);

  if (!ready || !aiEnabled || !imageEnabled) {
    return null;
  }

  const showImageResolution = imageProvider === 'gemini';
  const showImageAspectRatio = imageProvider === 'gemini';
  const showImageSize = imageProvider !== 'gemini';
  const providerLabel = imageProvider === 'openai'
    ? 'OpenAI'
    : imageProvider === 'gemini'
      ? 'Gemini'
      : imageProvider;

  return (
    <div className="card p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">AI Image Generator</h2>
        <p className="text-sm text-muted-foreground">
          Create a new AI image and add it to your library.
        </p>
        <p className="text-xs text-muted-foreground">Default provider: {providerLabel}</p>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <label className="block text-sm font-medium text-muted-foreground" htmlFor="ai-media-prompt">
            Prompt
          </label>
          <textarea
            id="ai-media-prompt"
            rows={3}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            placeholder="Describe the image you want to generate"
            disabled={busy}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground" htmlFor="ai-media-style">
            Style (optional)
          </label>
          <input
            id="ai-media-style"
            type="text"
            value={style}
            onChange={(event) => setStyle(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            placeholder="e.g., minimal, editorial, cinematic"
            disabled={busy}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {showImageSize && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground" htmlFor="ai-media-size">
                Image size
              </label>
              <select
                id="ai-media-size"
                value={imageSize}
                onChange={(event) => setImageSize(event.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                disabled={busy}
              >
                <option value="1024x1024">1024 × 1024 (Square)</option>
                <option value="1792x1024">1792 × 1024 (Landscape)</option>
                <option value="1024x1792">1024 × 1792 (Portrait)</option>
              </select>
            </div>
          )}

          {showImageAspectRatio && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground" htmlFor="ai-media-aspect">
                Aspect ratio
              </label>
              <select
                id="ai-media-aspect"
                value={imageAspectRatio}
                onChange={(event) => setImageAspectRatio(event.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                disabled={busy}
              >
                <option value="1:1">1:1 (Square)</option>
                <option value="2:3">2:3</option>
                <option value="3:2">3:2</option>
                <option value="3:4">3:4</option>
                <option value="4:3">4:3</option>
                <option value="4:5">4:5</option>
                <option value="5:4">5:4</option>
                <option value="9:16">9:16</option>
                <option value="16:9">16:9</option>
                <option value="21:9">21:9</option>
              </select>
            </div>
          )}

          {showImageResolution && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground" htmlFor="ai-media-resolution">
                Gemini resolution
              </label>
              <select
                id="ai-media-resolution"
                value={imageResolution}
                onChange={(event) => setImageResolution(event.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                disabled={busy}
              >
                <option value="1K">1K</option>
                <option value="2K">2K</option>
                <option value="4K">4K</option>
              </select>
            </div>
          )}
        </div>

        {showImageAspectRatio && (
          <p className="text-[11px] text-muted-foreground">
            Gemini outputs images by aspect ratio and resolution, not exact pixels.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        className="btn btn-primary w-full"
        disabled={busy || !prompt.trim()}
      >
        {busy ? 'Generating image…' : 'Generate AI Image'}
      </button>

      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
};
