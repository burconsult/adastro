import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeFeatureFlag } from '@/lib/features/flags';
import type { PostEditorExtensionProps } from '../../types.js';

const AI_REQUEST_TIMEOUT_MS = 120_000;

const aiFetchJson = async (url: string, body: unknown, timeoutMs = AI_REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const responseClone = response.clone();
    const payload = await response.json().catch(async () => {
      const text = await responseClone.text().catch(() => '');
      return text ? { error: text } : null;
    });

    if (!response.ok) {
      throw new Error(payload?.error || 'AI request failed');
    }

    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('AI request timed out. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
};

const normalizeOpenAiImageSize = (value?: string): string => {
  if (value === '1536x1024') return '1792x1024';
  if (value === '1024x1536') return '1024x1792';
  if (value === '1792x1024' || value === '1024x1792' || value === '1024x1024') {
    return value;
  }
  return '1024x1024';
};

export const AiPostEditorTools: React.FC<PostEditorExtensionProps> = ({
  formData,
  tags,
  setFeaturedImage,
  setAudioAsset,
  notify
}) => {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [imageEnabled, setImageEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [imageProviderReady, setImageProviderReady] = useState(false);
  const [audioProviderReady, setAudioProviderReady] = useState(false);
  const [imageCapabilityEnabled, setImageCapabilityEnabled] = useState(true);
  const [audioCapabilityEnabled, setAudioCapabilityEnabled] = useState(true);
  const [aiImageBusy, setAiImageBusy] = useState(false);
  const [aiAudioBusy, setAiAudioBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiImageSize, setAiImageSize] = useState('1024x1024');
  const [aiImageAspectRatio, setAiImageAspectRatio] = useState('1:1');
  const [aiImageResolution, setAiImageResolution] = useState('1K');
  const [aiImageProvider, setAiImageProvider] = useState('openai');

  const selectedTagNames = useMemo(
    () => tags.filter((tag) => formData.tagIds.includes(tag.id)).map((tag) => tag.name),
    [formData.tagIds, tags]
  );

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const [settingsResponse, statusResponse] = await Promise.all([
          fetch('/api/admin/settings?keys=features.ai.enabled,features.ai.enableImages,features.ai.enableAudio,features.ai.imageSize,features.ai.imageAspectRatio,features.ai.imageResolution,features.ai.defaultProvider.image,features.ai.defaultProvider.audio'),
          fetch('/api/features/ai/status')
        ]);

        if (!settingsResponse.ok) {
          throw new Error('Failed to load AI settings');
        }

        const settings = await settingsResponse.json();
        const statusAvailable = statusResponse.ok;
        const status = statusAvailable ? await statusResponse.json() : null;
        const aiSuiteEnabled = normalizeFeatureFlag(settings['features.ai.enabled'], false);
        const configuredImageProvider = settings['features.ai.defaultProvider.image'] || 'openai';
        const configuredAudioProvider = settings['features.ai.defaultProvider.audio'] || 'openai';
        const imageProviders = Array.isArray(status?.imageProviders) ? status.imageProviders : [];
        const audioProviders = Array.isArray(status?.audioProviders) ? status.audioProviders : [];
        const imageProvider = imageProviders.includes(configuredImageProvider)
          ? configuredImageProvider
          : (imageProviders[0] || configuredImageProvider);
        const audioProvider = audioProviders.includes(configuredAudioProvider)
          ? configuredAudioProvider
          : (audioProviders[0] || configuredAudioProvider);
        const imageToggleEnabled = normalizeFeatureFlag(settings['features.ai.enableImages'], true);
        const audioToggleEnabled = normalizeFeatureFlag(settings['features.ai.enableAudio'], true);
        const hasImageProvider = imageProviders.length > 0 || !statusAvailable;
        const hasAudioProvider = audioProviders.length > 0 || !statusAvailable;

        if (cancelled) return;

        setAiEnabled(aiSuiteEnabled);
        setAiImageProvider(imageProvider);
        setAiImageSize(normalizeOpenAiImageSize(settings['features.ai.imageSize'] || '1024x1024'));
        setAiImageAspectRatio(settings['features.ai.imageAspectRatio'] || '1:1');
        setAiImageResolution(settings['features.ai.imageResolution'] || '1K');
        setImageCapabilityEnabled(imageToggleEnabled);
        setAudioCapabilityEnabled(audioToggleEnabled);
        setImageProviderReady(hasImageProvider);
        setAudioProviderReady(hasAudioProvider);
        setImageEnabled(aiSuiteEnabled && imageToggleEnabled && hasImageProvider);
        setAudioEnabled(aiSuiteEnabled && audioToggleEnabled && hasAudioProvider);
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to load AI settings', error);
          setAiEnabled(false);
          setImageEnabled(false);
          setAudioEnabled(false);
          setImageProviderReady(false);
          setAudioProviderReady(false);
          setImageCapabilityEnabled(false);
          setAudioCapabilityEnabled(false);
        }
      }
    };

    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGenerateImage = useCallback(async () => {
    if (!imageEnabled) {
      setAiMessage('AI image generation is disabled.');
      return;
    }
    try {
      setAiMessage('Generating image… This can take 30–90 seconds depending on provider load.');
      setAiImageBusy(true);
      const payload = await aiFetchJson('/api/features/ai/image', {
        title: formData.title,
        excerpt: formData.excerpt,
        tags: selectedTagNames,
        size: aiImageSize,
        resolution: aiImageResolution,
        aspectRatio: aiImageAspectRatio
      });
      if (!payload?.media) {
        throw new Error('Image generation did not return a media asset');
      }

      setFeaturedImage(payload.media);
      setAiMessage('AI image generated and set as featured.');
      notify('AI image generated and set as featured.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI image generation failed';
      setAiMessage(message);
      notify(message, 'error');
    } finally {
      setAiImageBusy(false);
    }
  }, [
    aiImageAspectRatio,
    aiImageResolution,
    aiImageSize,
    formData.excerpt,
    formData.title,
    imageEnabled,
    notify,
    selectedTagNames,
    setFeaturedImage
  ]);

  const handleGenerateAudio = useCallback(async () => {
    if (!audioEnabled) {
      setAiMessage('AI audio generation is disabled.');
      return;
    }
    try {
      setAiMessage(null);
      setAiAudioBusy(true);
      const payload = await aiFetchJson('/api/features/ai/audio', {
        title: formData.title,
        content: formData.content
      });
      if (!payload?.media) {
        throw new Error('Audio generation did not return a media asset');
      }

      setAudioAsset(payload.media);
      setAiMessage('Audio narration generated.');
      notify('Audio narration generated.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI audio generation failed';
      setAiMessage(message);
      notify(message, 'error');
    } finally {
      setAiAudioBusy(false);
    }
  }, [audioEnabled, formData.content, formData.title, notify, setAudioAsset]);

  if (!aiEnabled || (!imageProviderReady && !audioProviderReady)) {
    return null;
  }

  const showImageResolution = aiImageProvider === 'gemini';
  const showImageAspectRatio = aiImageProvider === 'gemini';
  const showImageSize = aiImageProvider !== 'gemini';

  return (
    <div className="card p-4 space-y-3">
      <div>
        <h4 className="font-semibold">AI Tools</h4>
        <p className="text-xs text-muted-foreground">Generate assets and enhancements.</p>
      </div>
      {imageProviderReady && (
        <div className="space-y-2 text-xs">
          {showImageSize && (
            <>
              <label className="block text-muted-foreground" htmlFor="ai-image-size">
                Image size
              </label>
              <select
                id="ai-image-size"
                value={aiImageSize}
                onChange={(event) => setAiImageSize(event.target.value)}
                className="w-full rounded-md border border-border px-2 py-1 text-sm"
                disabled={aiImageBusy}
              >
                <option value="1024x1024">1024 × 1024 (Square)</option>
                <option value="1792x1024">1792 × 1024 (Landscape)</option>
                <option value="1024x1792">1024 × 1792 (Portrait)</option>
              </select>
            </>
          )}
          {showImageAspectRatio && (
            <>
              <label className="block text-muted-foreground" htmlFor="ai-image-aspect">
                Aspect ratio
              </label>
              <select
                id="ai-image-aspect"
                value={aiImageAspectRatio}
                onChange={(event) => setAiImageAspectRatio(event.target.value)}
                className="w-full rounded-md border border-border px-2 py-1 text-sm"
                disabled={aiImageBusy}
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
            </>
          )}
          {showImageResolution && (
            <>
              <label className="block text-muted-foreground" htmlFor="ai-image-resolution">
                Gemini resolution
              </label>
              <select
                id="ai-image-resolution"
                value={aiImageResolution}
                onChange={(event) => setAiImageResolution(event.target.value)}
                className="w-full rounded-md border border-border px-2 py-1 text-sm"
                disabled={aiImageBusy}
              >
                <option value="1K">1K</option>
                <option value="2K">2K</option>
                <option value="4K">4K</option>
              </select>
            </>
          )}
          {showImageAspectRatio && (
            <p className="text-[11px] text-muted-foreground">
              Gemini outputs images by aspect ratio + resolution, not exact pixels.
            </p>
          )}
        </div>
      )}
      {imageProviderReady && (
        <button
          type="button"
          onClick={handleGenerateImage}
          className="btn btn-outline w-full"
          disabled={aiImageBusy || !formData.title.trim() || !imageCapabilityEnabled}
        >
          {aiImageBusy ? 'Generating image…' : 'Generate Featured Image'}
        </button>
      )}
      {imageProviderReady && !imageCapabilityEnabled && (
        <p className="text-xs text-muted-foreground">
          Enable AI Images in Features → AI Suite to generate featured images.
        </p>
      )}
      {audioProviderReady && (
        <button
          type="button"
          onClick={handleGenerateAudio}
          className="btn btn-outline w-full"
          disabled={aiAudioBusy || !formData.content.trim() || !audioCapabilityEnabled}
        >
          {aiAudioBusy ? 'Generating audio…' : 'Generate Audio Version'}
        </button>
      )}
      {audioProviderReady && !audioCapabilityEnabled && (
        <p className="text-xs text-muted-foreground">
          Enable AI Audio in Features → AI Suite to generate article narration.
        </p>
      )}
      {!imageProviderReady && !audioProviderReady && (
        <p className="text-xs text-muted-foreground">
          No AI providers configured for image or audio generation. Add provider keys in host environment variables and redeploy.
        </p>
      )}
      {aiMessage && (
        <p className="text-xs text-muted-foreground">{aiMessage}</p>
      )}
    </div>
  );
};
