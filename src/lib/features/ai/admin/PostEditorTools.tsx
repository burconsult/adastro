import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeFeatureFlag } from '@/lib/features/flags';
import type { PostEditorExtensionProps } from '../../types.js';

const AI_REQUEST_TIMEOUT_MS = 120_000;

type DraftSuggestions = {
  titleSuggestions: string[];
  excerpt: string;
  slug: string;
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  };
  categoryIds: string[];
  tagIds: string[];
  tagNames: string[];
  unmatchedTagNames: string[];
  notes: string[];
  provider?: string;
  model?: string;
};

type ReviewFinding = {
  field: string;
  message: string;
};

type EditorialReview = {
  summary: string;
  heuristics: ReviewFinding[];
  aiWarnings: ReviewFinding[];
  quickWins: string[];
  provider?: string;
  model?: string;
};

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

const mergeUniqueIds = (currentIds: string[], nextIds: string[]) => Array.from(new Set([...currentIds, ...nextIds]));

const findingFieldLabel = (field: string) => {
  if (field === 'featuredImage') return 'Featured image';
  if (field === 'seo') return 'SEO';
  return field.charAt(0).toUpperCase() + field.slice(1);
};

export const AiPostEditorTools: React.FC<PostEditorExtensionProps> = ({
  formData,
  categories,
  tags,
  updateField,
  setFeaturedImage,
  setAudioAsset,
  notify
}) => {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [textProviderReady, setTextProviderReady] = useState(false);
  const [imageProviderReady, setImageProviderReady] = useState(false);
  const [audioProviderReady, setAudioProviderReady] = useState(false);
  const [imageCapabilityEnabled, setImageCapabilityEnabled] = useState(true);
  const [audioCapabilityEnabled, setAudioCapabilityEnabled] = useState(true);
  const [aiImageBusy, setAiImageBusy] = useState(false);
  const [aiAudioBusy, setAiAudioBusy] = useState(false);
  const [aiDraftBusy, setAiDraftBusy] = useState(false);
  const [aiReviewBusy, setAiReviewBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [draftSuggestions, setDraftSuggestions] = useState<DraftSuggestions | null>(null);
  const [editorialReview, setEditorialReview] = useState<EditorialReview | null>(null);
  const [aiImageSize, setAiImageSize] = useState('1024x1024');
  const [aiImageAspectRatio, setAiImageAspectRatio] = useState('1:1');
  const [aiImageResolution, setAiImageResolution] = useState('1K');
  const [aiImageProvider, setAiImageProvider] = useState('openai');

  const selectedTagNames = useMemo(
    () => tags.filter((tag) => formData.tagIds.includes(tag.id)).map((tag) => tag.name),
    [formData.tagIds, tags]
  );

  const suggestedCategoryLabels = useMemo(() => {
    if (!draftSuggestions) return [];
    const categoryIndex = new Map(categories.map((category) => [category.id, category.name] as const));
    return draftSuggestions.categoryIds.map((categoryId) => categoryIndex.get(categoryId) || categoryId);
  }, [categories, draftSuggestions]);

  const suggestedMatchedTagLabels = useMemo(() => {
    if (!draftSuggestions) return [];
    const tagIndex = new Map(tags.map((tag) => [tag.id, tag.name] as const));
    return draftSuggestions.tagIds.map((tagId) => tagIndex.get(tagId) || tagId);
  }, [draftSuggestions, tags]);

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const [settingsResponse, statusResponse] = await Promise.all([
          fetch('/api/admin/settings?keys=features.ai.enabled,features.ai.tools.image.enabled,features.ai.tools.audio.enabled,features.ai.capabilities.text.defaultProvider,features.ai.capabilities.image.defaultSize,features.ai.capabilities.image.defaultAspectRatio,features.ai.capabilities.image.defaultResolution,features.ai.capabilities.image.defaultProvider,features.ai.capabilities.audio.defaultProvider'),
          fetch('/api/features/ai/status')
        ]);

        if (!settingsResponse.ok) {
          throw new Error('Failed to load AI settings');
        }

        const settings = await settingsResponse.json();
        const statusAvailable = statusResponse.ok;
        const status = statusAvailable ? await statusResponse.json() : null;
        const aiSuiteEnabled = normalizeFeatureFlag(settings['features.ai.enabled'], false);
        const configuredTextProvider = settings['features.ai.capabilities.text.defaultProvider'] || 'gateway';
        const configuredImageProvider = settings['features.ai.capabilities.image.defaultProvider'] || 'gateway';
        const configuredAudioProvider = settings['features.ai.capabilities.audio.defaultProvider'] || 'elevenlabs';
        const textProviders = Array.isArray(status?.textProviders) ? status.textProviders : [];
        const imageProviders = Array.isArray(status?.imageProviders) ? status.imageProviders : [];
        const audioProviders = Array.isArray(status?.audioProviders) ? status.audioProviders : [];
        const imageProvider = imageProviders.includes(configuredImageProvider)
          ? configuredImageProvider
          : (imageProviders[0] || configuredImageProvider);
        const imageToggleEnabled = normalizeFeatureFlag(settings['features.ai.tools.image.enabled'], true);
        const audioToggleEnabled = normalizeFeatureFlag(settings['features.ai.tools.audio.enabled'], false);
        const hasTextProvider = textProviders.includes(configuredTextProvider) || textProviders.length > 0 || !statusAvailable;
        const hasImageProvider = imageProviders.length > 0 || !statusAvailable;
        const hasAudioProvider = audioProviders.includes(configuredAudioProvider) || audioProviders.length > 0 || !statusAvailable;

        if (cancelled) return;

        setAiEnabled(aiSuiteEnabled);
        setAiImageProvider(imageProvider);
        setAiImageSize(normalizeOpenAiImageSize(settings['features.ai.capabilities.image.defaultSize'] || '1024x1024'));
        setAiImageAspectRatio(settings['features.ai.capabilities.image.defaultAspectRatio'] || '1:1');
        setAiImageResolution(settings['features.ai.capabilities.image.defaultResolution'] || '1K');
        setTextProviderReady(hasTextProvider);
        setImageCapabilityEnabled(imageToggleEnabled);
        setAudioCapabilityEnabled(audioToggleEnabled);
        setImageProviderReady(hasImageProvider);
        setAudioProviderReady(hasAudioProvider);
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to load AI settings', error);
          setAiEnabled(false);
          setTextProviderReady(false);
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
    if (!aiEnabled || !imageCapabilityEnabled || !imageProviderReady) {
      setAiMessage('AI image generation is disabled.');
      return;
    }
    try {
      setAiMessage('Generating image... This can take 30-90 seconds depending on provider load.');
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
    aiEnabled,
    aiImageAspectRatio,
    aiImageResolution,
    aiImageSize,
    formData.excerpt,
    formData.title,
    imageCapabilityEnabled,
    imageProviderReady,
    notify,
    selectedTagNames,
    setFeaturedImage
  ]);

  const handleGenerateAudio = useCallback(async () => {
    if (!aiEnabled || !audioCapabilityEnabled || !audioProviderReady) {
      setAiMessage('AI audio generation is disabled.');
      return;
    }
    try {
      setAiMessage(null);
      setAiAudioBusy(true);
      const payload = await aiFetchJson('/api/features/ai/audio', {
        title: formData.title,
        content: formData.content,
        locale: formData.locale,
        authorId: formData.authorId
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
  }, [aiEnabled, audioCapabilityEnabled, audioProviderReady, formData.authorId, formData.content, formData.locale, formData.title, notify, setAudioAsset]);

  const handleGenerateDraft = useCallback(async () => {
    if (!aiEnabled || !textProviderReady) {
      setAiMessage('AI text assistance is unavailable.');
      return;
    }

    try {
      setAiDraftBusy(true);
      setAiMessage(null);
      const payload = await aiFetchJson('/api/features/ai/draft', {
        title: formData.title,
        slug: formData.slug,
        excerpt: formData.excerpt,
        content: formData.content,
        locale: formData.locale,
        categories: categories.map((category) => ({ id: category.id, name: category.name, slug: category.slug })),
        tags: tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug })),
        currentCategoryIds: formData.categoryIds,
        currentTagIds: formData.tagIds,
        seoMetadata: formData.seoMetadata
      });
      if (!payload?.suggestions) {
        throw new Error('Draft assist did not return suggestions');
      }

      setDraftSuggestions({
        ...payload.suggestions,
        provider: payload.provider,
        model: payload.model
      });
      setAiMessage('Draft suggestions are ready to apply.');
      notify('Draft suggestions generated.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Draft assist failed';
      setAiMessage(message);
      notify(message, 'error');
    } finally {
      setAiDraftBusy(false);
    }
  }, [aiEnabled, categories, formData.categoryIds, formData.content, formData.excerpt, formData.locale, formData.seoMetadata, formData.slug, formData.tagIds, formData.title, notify, tags, textProviderReady]);

  const handleRunEditorialQa = useCallback(async () => {
    if (!aiEnabled || !textProviderReady) {
      setAiMessage('AI text assistance is unavailable.');
      return;
    }

    try {
      setAiReviewBusy(true);
      setAiMessage(null);
      const payload = await aiFetchJson('/api/features/ai/review', {
        title: formData.title,
        excerpt: formData.excerpt,
        content: formData.content,
        locale: formData.locale,
        categories: categories.map((category) => ({ id: category.id, name: category.name, slug: category.slug })),
        tags: tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug })),
        currentCategoryIds: formData.categoryIds,
        currentTagIds: formData.tagIds,
        seoMetadata: formData.seoMetadata,
        hasFeaturedImage: Boolean(formData.featuredImage?.id),
        featuredImageAltText: formData.featuredImage?.altText || '',
        hasAudioAsset: Boolean(formData.audioAsset?.id)
      });
      if (!payload?.review) {
        throw new Error('Editorial QA did not return a review');
      }

      setEditorialReview({
        ...payload.review,
        provider: payload.provider,
        model: payload.model
      });
      setAiMessage('Editorial QA finished. Review the warnings below.');
      notify('Editorial QA complete.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Editorial QA failed';
      setAiMessage(message);
      notify(message, 'error');
    } finally {
      setAiReviewBusy(false);
    }
  }, [aiEnabled, categories, formData.audioAsset, formData.categoryIds, formData.content, formData.excerpt, formData.featuredImage, formData.locale, formData.seoMetadata, formData.tagIds, formData.title, notify, tags, textProviderReady]);

  const applySeoSuggestion = () => {
    if (!draftSuggestions?.seo) return;
    updateField('seoMetadata', {
      ...formData.seoMetadata,
      metaTitle: draftSuggestions.seo.metaTitle || formData.seoMetadata?.metaTitle,
      metaDescription: draftSuggestions.seo.metaDescription || formData.seoMetadata?.metaDescription,
      keywords: draftSuggestions.seo.keywords?.length ? draftSuggestions.seo.keywords : formData.seoMetadata?.keywords
    });
    notify('SEO suggestions applied.', 'success');
  };

  const applyMatchingTags = () => {
    if (!draftSuggestions?.tagIds?.length) return;
    updateField('tagIds', mergeUniqueIds(formData.tagIds, draftSuggestions.tagIds));
    notify('Matching tag suggestions applied.', 'success');
  };

  const applySuggestedCategories = () => {
    if (!draftSuggestions?.categoryIds?.length) return;
    updateField('categoryIds', draftSuggestions.categoryIds);
    notify('Suggested categories applied.', 'success');
  };

  const applyAllSuggestions = () => {
    if (!draftSuggestions) return;
    if (draftSuggestions.titleSuggestions[0]) {
      updateField('title', draftSuggestions.titleSuggestions[0]);
    }
    if (draftSuggestions.excerpt) {
      updateField('excerpt', draftSuggestions.excerpt);
    }
    if (draftSuggestions.slug) {
      updateField('slug', draftSuggestions.slug);
    }
    if (draftSuggestions.categoryIds.length > 0) {
      updateField('categoryIds', draftSuggestions.categoryIds);
    }
    if (draftSuggestions.tagIds.length > 0) {
      updateField('tagIds', mergeUniqueIds(formData.tagIds, draftSuggestions.tagIds));
    }
    updateField('seoMetadata', {
      ...formData.seoMetadata,
      metaTitle: draftSuggestions.seo?.metaTitle || formData.seoMetadata?.metaTitle,
      metaDescription: draftSuggestions.seo?.metaDescription || formData.seoMetadata?.metaDescription,
      keywords: draftSuggestions.seo?.keywords?.length ? draftSuggestions.seo.keywords : formData.seoMetadata?.keywords
    });
    notify('Draft suggestions applied.', 'success');
  };

  if (!aiEnabled || (!textProviderReady && !imageProviderReady && !audioProviderReady)) {
    return null;
  }

  const showImageResolution = aiImageProvider === 'gemini';
  const showImageAspectRatio = aiImageProvider === 'gemini';
  const showImageSize = aiImageProvider !== 'gemini';

  return (
    <div className="card space-y-4 p-4">
      <div>
        <h4 className="font-semibold">AI Tools</h4>
        <p className="text-xs text-muted-foreground">Draft assistance, editorial review, and media generation for the current post.</p>
      </div>

      {textProviderReady && (
        <>
          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h5 className="text-sm font-semibold">Draft Assist</h5>
                <p className="text-xs text-muted-foreground">Suggest title, excerpt, slug, categories, tags, and SEO copy.</p>
              </div>
              <button
                type="button"
                onClick={handleGenerateDraft}
                className="btn btn-outline"
                disabled={aiDraftBusy || (!formData.title.trim() && !formData.content.trim())}
              >
                {aiDraftBusy ? 'Generating...' : 'Generate Suggestions'}
              </button>
            </div>

            {draftSuggestions && (
              <div className="space-y-3 text-xs">
                {draftSuggestions.titleSuggestions.length > 0 && (
                  <div className="space-y-2 rounded-md border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">Title options</span>
                      <button
                        type="button"
                        className="btn btn-outline h-8 px-3"
                        onClick={() => {
                          updateField('title', draftSuggestions.titleSuggestions[0]);
                          notify('Top title suggestion applied.', 'success');
                        }}
                      >
                        Apply Top Title
                      </button>
                    </div>
                    <div className="space-y-2">
                      {draftSuggestions.titleSuggestions.map((title) => (
                        <button
                          key={title}
                          type="button"
                          className="w-full rounded-md border border-border/60 px-3 py-2 text-left transition hover:bg-muted/60"
                          onClick={() => {
                            updateField('title', title);
                            notify('Title suggestion applied.', 'success');
                          }}
                        >
                          {title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {draftSuggestions.excerpt && (
                  <div className="space-y-2 rounded-md border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">Excerpt</span>
                      <button
                        type="button"
                        className="btn btn-outline h-8 px-3"
                        onClick={() => {
                          updateField('excerpt', draftSuggestions.excerpt);
                          notify('Excerpt suggestion applied.', 'success');
                        }}
                      >
                        Apply Excerpt
                      </button>
                    </div>
                    <p className="text-muted-foreground">{draftSuggestions.excerpt}</p>
                  </div>
                )}

                {draftSuggestions.slug && (
                  <div className="space-y-2 rounded-md border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">Slug</span>
                      <button
                        type="button"
                        className="btn btn-outline h-8 px-3"
                        onClick={() => {
                          updateField('slug', draftSuggestions.slug);
                          notify('Slug suggestion applied.', 'success');
                        }}
                      >
                        Apply Slug
                      </button>
                    </div>
                    <code className="block rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">{draftSuggestions.slug}</code>
                  </div>
                )}

                {(draftSuggestions.seo?.metaTitle || draftSuggestions.seo?.metaDescription || draftSuggestions.seo?.keywords?.length) && (
                  <div className="space-y-2 rounded-md border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">SEO</span>
                      <button
                        type="button"
                        className="btn btn-outline h-8 px-3"
                        onClick={applySeoSuggestion}
                      >
                        Apply SEO
                      </button>
                    </div>
                    {draftSuggestions.seo?.metaTitle && (
                      <p className="text-muted-foreground"><span className="font-medium text-foreground">Meta title:</span> {draftSuggestions.seo.metaTitle}</p>
                    )}
                    {draftSuggestions.seo?.metaDescription && (
                      <p className="text-muted-foreground"><span className="font-medium text-foreground">Meta description:</span> {draftSuggestions.seo.metaDescription}</p>
                    )}
                    {draftSuggestions.seo?.keywords?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {draftSuggestions.seo.keywords.map((keyword) => (
                          <span key={keyword} className="rounded-full border border-border/60 px-2 py-1 text-[11px] text-muted-foreground">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}

                {(suggestedCategoryLabels.length > 0 || draftSuggestions.tagNames.length > 0) && (
                  <div className="space-y-3 rounded-md border border-border/60 p-3">
                    {suggestedCategoryLabels.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">Categories</span>
                          <button
                            type="button"
                            className="btn btn-outline h-8 px-3"
                            onClick={applySuggestedCategories}
                          >
                            Apply Categories
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {suggestedCategoryLabels.map((category) => (
                            <span key={category} className="rounded-full border border-border/60 px-2 py-1 text-[11px] text-muted-foreground">
                              {category}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {draftSuggestions.tagNames.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">Tags</span>
                          <button
                            type="button"
                            className="btn btn-outline h-8 px-3"
                            onClick={applyMatchingTags}
                            disabled={draftSuggestions.tagIds.length === 0}
                          >
                            Apply Matching Tags
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {draftSuggestions.tagNames.map((tagName) => (
                            <span key={tagName} className="rounded-full border border-border/60 px-2 py-1 text-[11px] text-muted-foreground">
                              {tagName}
                            </span>
                          ))}
                        </div>
                        {suggestedMatchedTagLabels.length > 0 && (
                          <p className="text-muted-foreground">Matched existing tags: {suggestedMatchedTagLabels.join(', ')}</p>
                        )}
                        {draftSuggestions.unmatchedTagNames.length > 0 && (
                          <p className="text-muted-foreground">New tag ideas to add manually: {draftSuggestions.unmatchedTagNames.join(', ')}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {draftSuggestions.notes.length > 0 && (
                  <div className="space-y-2 rounded-md border border-border/60 p-3">
                    <span className="font-medium">Why these suggestions</span>
                    <ul className="space-y-1 text-muted-foreground">
                      {draftSuggestions.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
                  <button
                    type="button"
                    className="btn btn-primary h-8 px-3"
                    onClick={applyAllSuggestions}
                  >
                    Apply All Suggestions
                  </button>
                  <span className="text-[11px] text-muted-foreground">
                    {draftSuggestions.provider && draftSuggestions.model ? `${draftSuggestions.provider} / ${draftSuggestions.model}` : 'AI text suggestion'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h5 className="text-sm font-semibold">Editorial QA</h5>
                <p className="text-xs text-muted-foreground">Warning-only review for metadata, structure, and publish readiness.</p>
              </div>
              <button
                type="button"
                onClick={handleRunEditorialQa}
                className="btn btn-outline"
                disabled={aiReviewBusy || (!formData.title.trim() && !formData.content.trim())}
              >
                {aiReviewBusy ? 'Reviewing...' : 'Run Editorial QA'}
              </button>
            </div>

            {editorialReview && (
              <div className="space-y-3 text-xs">
                {editorialReview.summary && (
                  <div className="rounded-md border border-border/60 p-3 text-muted-foreground">
                    {editorialReview.summary}
                  </div>
                )}

                {editorialReview.heuristics.length > 0 && (
                  <div className="space-y-2 rounded-md border border-amber-300/50 bg-amber-50/70 p-3 text-amber-950">
                    <span className="font-medium">Rule-based warnings</span>
                    <div className="space-y-2">
                      {editorialReview.heuristics.map((warning, index) => (
                        <div key={`${warning.field}-${index}`} className="rounded-md border border-amber-300/40 bg-white/60 px-3 py-2">
                          <span className="font-medium">{findingFieldLabel(warning.field)}:</span> {warning.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editorialReview.aiWarnings.length > 0 && (
                  <div className="space-y-2 rounded-md border border-border/60 p-3">
                    <span className="font-medium">AI review warnings</span>
                    <div className="space-y-2">
                      {editorialReview.aiWarnings.map((warning, index) => (
                        <div key={`${warning.field}-${index}`} className="rounded-md border border-border/60 px-3 py-2 text-muted-foreground">
                          <span className="font-medium text-foreground">{findingFieldLabel(warning.field)}:</span> {warning.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editorialReview.quickWins.length > 0 && (
                  <div className="space-y-2 rounded-md border border-border/60 p-3">
                    <span className="font-medium">Quick wins</span>
                    <ul className="space-y-1 text-muted-foreground">
                      {editorialReview.quickWins.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground">
                  Warning only. Nothing here blocks publishing. {editorialReview.provider && editorialReview.model ? `Reviewed with ${editorialReview.provider} / ${editorialReview.model}.` : ''}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {imageProviderReady && (
        <div className="space-y-3 rounded-lg border border-border/60 p-3">
          <div>
            <h5 className="text-sm font-semibold">Featured Image</h5>
            <p className="text-xs text-muted-foreground">Generate a featured image from the current title, excerpt, and tags.</p>
          </div>

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
                  <option value="1024x1024">1024 x 1024 (Square)</option>
                  <option value="1792x1024">1792 x 1024 (Landscape)</option>
                  <option value="1024x1792">1024 x 1792 (Portrait)</option>
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
                Gemini outputs images by aspect ratio and resolution, not exact pixel dimensions.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleGenerateImage}
            className="btn btn-outline w-full"
            disabled={aiImageBusy || !formData.title.trim() || !imageCapabilityEnabled}
          >
            {aiImageBusy ? 'Generating image...' : 'Generate Featured Image'}
          </button>
          {!imageCapabilityEnabled && (
            <p className="text-xs text-muted-foreground">
              Enable AI Images in Features -&gt; AI Suite to generate featured images.
            </p>
          )}
        </div>
      )}

      {audioProviderReady && (
        <div className="space-y-3 rounded-lg border border-border/60 p-3">
          <div>
            <h5 className="text-sm font-semibold">Audio Narration</h5>
            <p className="text-xs text-muted-foreground">Generate a narrated version using the locale-aware intro/outro templates configured by admins.</p>
          </div>
          <button
            type="button"
            onClick={handleGenerateAudio}
            className="btn btn-outline w-full"
            disabled={aiAudioBusy || !formData.content.trim() || !audioCapabilityEnabled}
          >
            {aiAudioBusy ? 'Generating audio...' : 'Generate Audio Version'}
          </button>
          {!audioCapabilityEnabled && (
            <p className="text-xs text-muted-foreground">
              Enable AI Audio in Features -&gt; AI Suite to generate article narration.
            </p>
          )}
        </div>
      )}

      {!textProviderReady && !imageProviderReady && !audioProviderReady && (
        <p className="text-xs text-muted-foreground">
          No AI providers are configured for text, image, or audio generation. Add provider keys in host environment variables and redeploy.
        </p>
      )}

      {aiMessage && (
        <p className="text-xs text-muted-foreground">{aiMessage}</p>
      )}
    </div>
  );
};
