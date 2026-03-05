import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import PostContentEditor from './PostContentEditor';
import EditorJSEditor from './EditorJSEditor';
import { MediaManager } from './MediaManager';
import { SEOMetadataEditor } from './SEOMetadataEditor';
import { CategoryTagSelector } from './CategoryTagSelector';
import { PublishingControls } from './PublishingControls';
import { ToastProvider, useToast } from '@/lib/components/ui/toast';
import { editorJsToHtml, htmlToEditorJs, normalizeEditorJsData } from '@/lib/editorjs';
import type { EditorJSData } from '@/lib/editorjs/types';
import type { BlogPost, Author, Category, Tag, SEOMetadata, MediaAsset } from '../types/index.js';
import { getPostEditorExtensions } from '@/lib/features/ui';

const areFieldValuesEqual = (prevValue: unknown, nextValue: unknown): boolean => {
  if (Object.is(prevValue, nextValue)) {
    return true;
  }

  if (prevValue instanceof Date && nextValue instanceof Date) {
    return prevValue.getTime() === nextValue.getTime();
  }

  if (
    prevValue &&
    nextValue &&
    typeof prevValue === 'object' &&
    typeof nextValue === 'object'
  ) {
    try {
      return JSON.stringify(prevValue) === JSON.stringify(nextValue);
    } catch {
      return false;
    }
  }

  return false;
};

interface PostEditorProps {
  post?: BlogPost;
  authors: Author[];
  categories: Category[];
  tags: Tag[];
  mode: 'create' | 'edit';
  blockEditorEnabled?: boolean;
  activeFeatureIds?: string[];
  articleBasePath?: string;
  articlePermalinkStyle?: 'segment' | 'wordpress';
  defaultLocale?: string;
  supportedLocales?: string[];
}

interface PostFormData {
  title: string;
  slug: string;
  locale: string;
  content: string;
  blocks: EditorJSData;
  excerpt: string;
  authorId: string;
  status: 'draft' | 'published' | 'scheduled';
  publishedAt?: Date;
  categoryIds: string[];
  tagIds: string[];
  featuredImageId?: string;
  featuredImage?: MediaAsset | null;
  audioAssetId?: string;
  audioAsset?: MediaAsset | null;
  seoMetadata: SEOMetadata;
}

const serializePostFormData = (data: PostFormData) => {
  return JSON.stringify({
    title: data.title,
    slug: data.slug,
    locale: data.locale,
    content: data.content,
    blocks: data.blocks,
    excerpt: data.excerpt,
    authorId: data.authorId,
    status: data.status,
    publishedAt: data.publishedAt ? data.publishedAt.toISOString() : null,
    categoryIds: data.categoryIds,
    tagIds: data.tagIds,
    featuredImageId: data.featuredImageId ?? null,
    featuredImage: data.featuredImage ? { id: data.featuredImage.id, url: data.featuredImage.url } : null,
    audioAssetId: data.audioAssetId ?? null,
    audioAsset: data.audioAsset ? { id: data.audioAsset.id, url: data.audioAsset.url } : null,
    seoMetadata: data.seoMetadata
  });
};

export const PostEditor: React.FC<PostEditorProps> = (props) => (
  <ToastProvider>
    <PostEditorInner {...props} />
  </ToastProvider>
);

const PostEditorInner: React.FC<PostEditorProps> = ({
  post,
  authors,
  categories,
  tags,
  mode,
  blockEditorEnabled = false,
  activeFeatureIds = [],
  articleBasePath = 'articles',
  articlePermalinkStyle = 'segment',
  defaultLocale = 'en',
  supportedLocales = ['en']
}) => {
  const { toast } = useToast();
  const normalizedPost = useMemo(() => {
    if (!post) return undefined;
    return {
      ...post,
      publishedAt: post.publishedAt ? new Date(post.publishedAt) : undefined,
      createdAt: post.createdAt ? new Date(post.createdAt) : undefined,
      updatedAt: post.updatedAt ? new Date(post.updatedAt) : undefined,
      categories: post.categories ?? [],
      tags: post.tags ?? [],
      blocks: normalizeEditorJsData(post.blocks ?? {})
    };
  }, [post]);

  const [tagOptions, setTagOptions] = useState<Tag[]>(tags);
  const [formData, setFormData] = useState<PostFormData>(() => ({
    title: normalizedPost?.title || '',
    slug: normalizedPost?.slug || '',
    locale: normalizedPost?.locale || defaultLocale,
    content: normalizedPost?.content || '',
    blocks: normalizedPost?.blocks ?? { blocks: [] },
    excerpt: normalizedPost?.excerpt || '',
    authorId: normalizedPost?.author?.id || authors[0]?.id || '',
    status: normalizedPost?.status || 'draft',
    publishedAt: normalizedPost?.publishedAt,
    categoryIds: normalizedPost?.categories.map((c) => c.id) || [],
    tagIds: normalizedPost?.tags.map((t) => t.id) || [],
    featuredImageId: normalizedPost?.featuredImage?.id,
    featuredImage: normalizedPost?.featuredImage || null,
    audioAssetId: normalizedPost?.audioAssetId,
    audioAsset: normalizedPost?.audioAsset || null,
    seoMetadata: normalizedPost?.seoMetadata || {}
  }));

  const [saving, setSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<'editorjs' | 'source'>(blockEditorEnabled ? 'editorjs' : 'source');
  const [showMediaManager, setShowMediaManager] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'conflict' | 'error'>('idle');
  const [slugMessage, setSlugMessage] = useState('');
  const [autosaveTimestamp, setAutosaveTimestamp] = useState<Date | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(normalizedPost?.updatedAt ?? null);
  const [slugDirty, setSlugDirty] = useState(() => Boolean(normalizedPost?.slug));
  const draftKey = useMemo(
    () => (mode === 'edit' && normalizedPost?.id ? `post-editor-${normalizedPost.id}` : 'post-editor-new'),
    [mode, normalizedPost?.id]
  );
  const [hydrated, setHydrated] = useState(false);
  const activeFeatureSet = useMemo(() => new Set(activeFeatureIds), [activeFeatureIds]);
  const editorExtensions = useMemo(
    () => getPostEditorExtensions().filter((extension) => activeFeatureSet.has(extension.id)),
    [activeFeatureSet]
  );
  const savedSnapshotRef = useRef(serializePostFormData(formData));
  const isEditorJsActive = blockEditorEnabled && editorMode === 'editorjs';
  const hasUnsavedChanges = useMemo(
    () => serializePostFormData(formData) !== savedSnapshotRef.current,
    [formData]
  );
  const selectedTagNames = useMemo(
    () => tagOptions.filter((tag) => formData.tagIds.includes(tag.id)).map((tag) => tag.name),
    [formData.tagIds, tagOptions]
  );
  const editorToolsLoaders = useMemo(
    () =>
      editorExtensions
        .map((extension) => extension.editorJsTools)
        .filter((loader): loader is NonNullable<typeof loader> => Boolean(loader)),
    [editorExtensions]
  );
  const seoPreviewPathTemplate = useMemo(() => {
    const localePrefix = `/${(formData.locale || defaultLocale).replace(/^\/+|\/+$/g, '')}`;
    if (articlePermalinkStyle === 'wordpress') {
      return `${localePrefix}/YYYY/MM/DD/{slug}/`;
    }
    const basePath = (articleBasePath || 'articles').replace(/^\/+|\/+$/g, '') || 'articles';
    return `${localePrefix}/${basePath}/{slug}/`;
  }, [articleBasePath, articlePermalinkStyle, defaultLocale, formData.locale]);
  const localeOptions = useMemo(() => {
    const normalized = Array.isArray(supportedLocales)
      ? supportedLocales.filter((locale) => typeof locale === 'string' && locale.trim().length > 0)
      : [];
    const deduped = Array.from(new Set(normalized));
    return deduped.length > 0 ? deduped : [defaultLocale];
  }, [defaultLocale, supportedLocales]);

  const updateField = useCallback((field: keyof typeof formData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const setFeaturedImage = useCallback((asset: MediaAsset) => {
    setFormData((prev) => ({
      ...prev,
      featuredImageId: asset.id,
      featuredImage: asset
    }));
  }, []);

  const setAudioAsset = useCallback((asset: MediaAsset) => {
    setFormData((prev) => ({
      ...prev,
      audioAssetId: asset.id,
      audioAsset: asset
    }));
  }, []);

  const notify = useCallback(
    (message: string, variant: 'success' | 'error' | 'info' = 'info') => {
      toast({
        description: message,
        variant: variant === 'error' ? 'destructive' : variant === 'success' ? 'success' : 'default'
      });
    },
    [toast]
  );

  const extensionFormData = useMemo(
    () => ({
      title: formData.title,
      excerpt: formData.excerpt,
      content: formData.content,
      tagIds: formData.tagIds,
      featuredImage: formData.featuredImage,
      audioAsset: formData.audioAsset,
      seoMetadata: formData.seoMetadata
    }),
    [formData]
  );

  const renderSeoActions = (controls: { disableAutoGenerate: () => void; autoGenerate: boolean }) => (
    <>
      {editorExtensions.map(({ id, SeoActions }) =>
        SeoActions ? (
          <SeoActions
            key={id}
            metadata={formData.seoMetadata}
            setMetadata={(metadata) => updateField('seoMetadata', metadata)}
            postTitle={formData.title}
            postExcerpt={formData.excerpt}
            postContent={formData.content}
            postTags={selectedTagNames}
            notify={notify}
            disableAutoGenerate={controls.disableAutoGenerate}
            autoGenerate={controls.autoGenerate}
          />
        ) : null
      )}
    </>
  );

  const sidebarPanels = editorExtensions.map(({ id, SidebarPanel }) =>
    SidebarPanel ? (
      <SidebarPanel
        key={id}
        post={normalizedPost}
        formData={extensionFormData}
        tags={tagOptions}
        updateField={updateField}
        setFeaturedImage={setFeaturedImage}
        setAudioAsset={setAudioAsset}
        notify={notify}
      />
    ) : null
  );

  useEffect(() => {
    if (typeof window === 'undefined' || hydrated) return;
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const parsedBlocks = normalizeEditorJsData(parsed.blocks ?? {});
        setFormData((prev) => ({
          ...prev,
          ...parsed,
          locale: typeof parsed.locale === 'string' && parsed.locale.trim().length > 0
            ? parsed.locale
            : prev.locale,
          blocks: parsedBlocks.blocks.length > 0 ? parsedBlocks : prev.blocks,
          publishedAt: parsed.publishedAt ? new Date(parsed.publishedAt) : prev.publishedAt,
          featuredImage: parsed.featuredImage || prev.featuredImage,
          audioAsset: parsed.audioAsset || prev.audioAsset
        }));
        if (parsed.updatedAt) {
          setAutosaveTimestamp(new Date(parsed.updatedAt));
        }
      }
    } catch (error) {
      console.warn('Failed to load draft from storage', error);
    } finally {
      setHydrated(true);
    }
  }, [draftKey, hydrated]);

  // Auto-generate slug from title when user hasn't edited slug manually
  useEffect(() => {
    if (!hydrated) return;
    if (!formData.title.trim()) return;
    if (slugDirty && formData.slug) return;
    const generated = generateSlug(formData.title);
    setFormData((prev) => (prev.slug === generated ? prev : { ...prev, slug: generated }));
  }, [formData.title, slugDirty, hydrated]);

  // Persist autosave to localStorage
  useEffect(() => {
    if (!hydrated) return;
    const handle = window.setTimeout(() => {
      try {
        const snapshot = {
          ...formData,
          publishedAt: formData.publishedAt ? formData.publishedAt.toISOString() : undefined,
          featuredImage: formData.featuredImage ?? null,
          updatedAt: new Date().toISOString()
        };
        window.localStorage.setItem(draftKey, JSON.stringify(snapshot));
        setAutosaveTimestamp(new Date(snapshot.updatedAt));
      } catch (error) {
        console.warn('Failed to persist draft', error);
      }
    }, 1000);

    return () => window.clearTimeout(handle);
  }, [formData, draftKey, hydrated]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasUnsavedChanges || saving) return;

    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const anchorNavigationHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      const isSameDocument = nextUrl.pathname === currentUrl.pathname
        && nextUrl.search === currentUrl.search
        && nextUrl.hash === currentUrl.hash;

      if (isSameDocument) return;

      const requestConfirm = (window as typeof window & {
        requestConfirm?: (options: {
          title: string;
          description?: string;
          confirmLabel?: string;
          cancelLabel?: string;
          tone?: 'default' | 'destructive';
        }) => Promise<boolean>;
      }).requestConfirm;

      event.preventDefault();
      event.stopPropagation();

      if (typeof requestConfirm === 'function') {
        void requestConfirm({
          title: 'Leave editor?',
          description: 'You have unsaved changes. Leave this page without saving?',
          confirmLabel: 'Leave page',
          cancelLabel: 'Stay here',
          tone: 'destructive'
        }).then((confirmed) => {
          if (confirmed) {
            window.location.href = nextUrl.toString();
          }
        });
      }
    };

    window.addEventListener('beforeunload', beforeUnloadHandler);
    document.addEventListener('click', anchorNavigationHandler, true);

    return () => {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
      document.removeEventListener('click', anchorNavigationHandler, true);
    };
  }, [hasUnsavedChanges, saving]);

  // Slug validation
  useEffect(() => {
    if (!hydrated) return;
    const slug = formData.slug.trim();
    if (!slug) {
      setSlugStatus('idle');
      setSlugMessage('');
      return;
    }

    let active = true;
    setSlugStatus('checking');
    setSlugMessage('Checking slug…');

    const handler = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ slug, locale: formData.locale || defaultLocale });
        if (mode === 'edit' && normalizedPost?.id) {
          params.set('excludeId', normalizedPost.id);
        }

        const response = await fetch(`/api/admin/posts/validate-slug?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Validation request failed');
        }

        const payload = await response.json();
        if (!active) return;

        if (payload.available) {
          setSlugStatus('available');
          setSlugMessage('Slug is available');
        } else {
          setSlugStatus('conflict');
          setSlugMessage('Slug already exists. Choose a different one.');
        }
      } catch (error) {
        if (!active) return;
        setSlugStatus('error');
        setSlugMessage('Unable to validate slug at the moment.');
      }
    }, 400);

    return () => {
      active = false;
      window.clearTimeout(handler);
    };
  }, [defaultLocale, formData.locale, formData.slug, mode, normalizedPost?.id, hydrated]);

  useEffect(() => {
    setTagOptions(tags);
  }, [tags]);

  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug is required';
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug)) {
      newErrors.slug = 'Slug must contain only lowercase letters, numbers, and hyphens';
    }
    if (!formData.locale.trim()) {
      newErrors.locale = 'Locale is required';
    }

    const hasLegacyContent = formData.content && formData.content.trim().length > 0;
    const hasBlocks = Array.isArray(formData.blocks?.blocks) && formData.blocks.blocks.length > 0;
    if (!hasLegacyContent && !hasBlocks) {
      newErrors.content = 'Add content before saving (blocks or HTML).';
    }

    if (!formData.authorId) {
      newErrors.authorId = 'Author is required';
    }

    if (slugStatus === 'conflict') {
      newErrors.slug = 'Slug already exists';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = useCallback(async (status: 'draft' | 'published' | 'scheduled', publishedAt?: Date) => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const nextPublishedAt = status === 'scheduled'
        ? (publishedAt ?? formData.publishedAt)
        : status === 'published'
          ? (formData.status === 'published' && formData.publishedAt ? formData.publishedAt : new Date())
          : undefined;
      const { featuredImage, audioAsset, ...rest } = formData;
      const normalizedBlocks = normalizeEditorJsData(rest.blocks ?? {});
      const contentFromBlocks = normalizedBlocks.blocks.length > 0 ? editorJsToHtml(normalizedBlocks) : '';
      const contentToPersist = rest.content && rest.content.trim().length > 0 ? rest.content : contentFromBlocks;
      const payload: Record<string, any> = {
        ...rest,
        content: contentToPersist,
        blocks: normalizedBlocks,
        status,
        audioAssetId: rest.audioAssetId
      };
      if (nextPublishedAt) {
        payload.publishedAt = nextPublishedAt;
      }

      const url = mode === 'create' ? '/api/admin/posts' : `/api/admin/posts/${post?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save post');
      }

      const savedPost = await response.json();
      const savedStatus = savedPost?.status ?? status;
      const savedPublishedAt = savedPost?.publishedAt
        ? new Date(savedPost.publishedAt)
        : nextPublishedAt;

      setFormData((prev) => ({
        ...prev,
        status: savedStatus,
        publishedAt: savedPublishedAt
      }));

      savedSnapshotRef.current = serializePostFormData({
        ...formData,
        status: savedStatus,
        publishedAt: savedPublishedAt
      });
      setLastSavedAt(new Date());

       if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftKey);
      }
      
      // Redirect to edit page if creating new post
      if (mode === 'create') {
        window.location.href = `/admin/posts/edit/${savedPost.id}`;
      } else {
        toast({
          variant: 'success',
          title: 'Post saved',
          description: `"${payload.title}" has been updated.`,
        });
      }
    } catch (error) {
      console.error('Error saving post:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to save post',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  }, [formData, mode, post?.id, draftKey, validateForm, toast]);

  const handleFieldChange = useCallback((field: keyof PostFormData, value: any) => {
    let didChange = false;

    setFormData((prev) => {
      const prevValue = prev[field];
      if (areFieldValuesEqual(prevValue, value)) {
        return prev;
      }

      didChange = true;
      return { ...prev, [field]: value };
    });

    if (!didChange) {
      return;
    }

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    if (field === 'slug') {
      setSlugDirty(Boolean(value));
    }
  }, [errors]);

  useEffect(() => {
    if (localeOptions.includes(formData.locale)) return;
    handleFieldChange('locale', localeOptions[0]);
  }, [formData.locale, handleFieldChange, localeOptions]);

  const handleBlocksChange = useCallback((nextBlocks: EditorJSData) => {
    setFormData((prev) => {
      const normalized = normalizeEditorJsData(nextBlocks);
      const nextContent = normalized.blocks.length > 0
        ? editorJsToHtml(normalized)
        : '';
      return {
        ...prev,
        blocks: normalized,
        content: nextContent
      };
    });
    setErrors((prevErrors) => (prevErrors.content ? { ...prevErrors, content: '' } : prevErrors));
  }, []);

  useEffect(() => {
    if (!isEditorJsActive) return;
    if (formData.blocks && formData.blocks.blocks.length > 0) return;
    if (!formData.content || formData.content.trim().length === 0) return;

    const converted = htmlToEditorJs(formData.content);
    if (converted.blocks.length === 0) return;

    setFormData((prev) => ({
      ...prev,
      blocks: converted
    }));
    setErrors((prevErrors) => (prevErrors.content ? { ...prevErrors, content: '' } : prevErrors));
  }, [formData.blocks?.blocks?.length, formData.content, isEditorJsActive]);

  const switchToEditorMode = useCallback(() => {
    setFormData((prev) => {
      const sourceContent = (prev.content || '').trim();
      const normalizedBlocks = normalizeEditorJsData(prev.blocks ?? {});

      if (!sourceContent) {
        if (normalizedBlocks.blocks.length === 0) {
          return prev;
        }
        return {
          ...prev,
          blocks: { blocks: [] }
        };
      }

      const blocksHtml = normalizedBlocks.blocks.length > 0
        ? editorJsToHtml(normalizedBlocks).trim()
        : '';
      if (blocksHtml === sourceContent) {
        return prev;
      }

      return {
        ...prev,
        blocks: htmlToEditorJs(sourceContent)
      };
    });
    setErrors((prevErrors) => (prevErrors.content ? { ...prevErrors, content: '' } : prevErrors));
    setEditorMode('editorjs');
  }, []);

  const handleMediaSelect = useCallback((media: MediaAsset) => {
    setFeaturedImage(media);
    setShowMediaManager(false);
  }, [setFeaturedImage]);

  return (
    <div className="post-editor">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Title and Slug */}
          <div className="card p-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium mb-2">
                  Title *
                </label>
                <input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md ${errors.title ? 'border-red-500' : 'border-input'}`}
                  placeholder="Enter post title..."
                />
                {errors.title && <p className="text-destructive text-sm mt-1">{errors.title}</p>}
              </div>

              <div>
                <label htmlFor="slug" className="block text-sm font-medium mb-2">
                  Slug *
                </label>
                <input
                  id="slug"
                  type="text"
                  value={formData.slug}
                  onChange={(e) => handleFieldChange('slug', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md ${errors.slug ? 'border-red-500' : 'border-input'}`}
                  placeholder="post-slug"
                />
                {errors.slug && <p className="text-destructive text-sm mt-1">{errors.slug}</p>}
                {!errors.slug && formData.slug && (
                  <p
                    className={`text-xs mt-1 ${
                      slugStatus === 'available'
                        ? 'text-success'
                        : slugStatus === 'conflict'
                          ? 'text-destructive'
                          : slugStatus === 'error'
                            ? 'text-amber-600'
                            : 'text-muted-foreground'
                    }`}
                  >
                    {slugStatus === 'checking' ? 'Checking slug…' : slugMessage}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="locale" className="block text-sm font-medium mb-2">
                  Locale *
                </label>
                <select
                  id="locale"
                  value={formData.locale}
                  onChange={(e) => handleFieldChange('locale', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md ${errors.locale ? 'border-red-500' : 'border-input'}`}
                >
                  {localeOptions.map((locale) => (
                    <option key={locale} value={locale}>
                      {locale}
                    </option>
                  ))}
                </select>
                {errors.locale && <p className="text-destructive text-sm mt-1">{errors.locale}</p>}
              </div>

              <div>
                <label htmlFor="excerpt" className="block text-sm font-medium mb-2">
                  Excerpt
                </label>
                <textarea
                  id="excerpt"
                  value={formData.excerpt}
                  onChange={(e) => handleFieldChange('excerpt', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  rows={3}
                  placeholder="Brief description of the post..."
                />
              </div>
            </div>
          </div>

          {/* Content Editor */}
          <div className="card p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Content</h3>
                <p className="text-sm text-muted-foreground">
                  Use blocks for content sections. Add video and audio blocks from the + menu, then paste a URL or pick a file from the media library.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {blockEditorEnabled && (
                  <div className="flex items-center gap-2 text-sm">
                    <button
                      type="button"
                      onClick={switchToEditorMode}
                      className={`px-3 py-1.5 border rounded-md transition-colors ${
                        isEditorJsActive ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode('source')}
                      className={`px-3 py-1.5 border rounded-md transition-colors ${
                        !isEditorJsActive ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      Source
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              {isEditorJsActive ? (
                <>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Use the block menu (six dots) to edit, move, duplicate, or remove individual blocks.
                  </p>
                  <EditorJSEditor
                    data={formData.blocks}
                    onChange={handleBlocksChange}
                    extraToolsLoaders={editorToolsLoaders}
                  />
                </>
              ) : (
                <PostContentEditor
                  content={formData.content}
                  onChange={(content) => handleFieldChange('content', content)}
                  showPreview={false}
                  splitView={false}
                  mode="html"
                  showFormatting={false}
                  showPreviewControls={false}
                  onTogglePreview={() => undefined}
                  onToggleSplitView={() => undefined}
                  onMediaInsert={() => undefined}
                  onEmbedInsert={() => undefined}
                  onLinkInsert={() => undefined}
                />
              )}
            </div>
            {errors.content && <p className="text-destructive text-sm mt-2">{errors.content}</p>}
          </div>

          {/* SEO Metadata */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">SEO Settings</h3>
            <SEOMetadataEditor
              metadata={formData.seoMetadata}
              onChange={(metadata) => handleFieldChange('seoMetadata', metadata)}
              postTitle={formData.title}
              postExcerpt={formData.excerpt}
              postContent={formData.content}
              postTags={selectedTagNames}
              previewPathTemplate={seoPreviewPathTemplate}
              actions={editorExtensions.some((extension) => extension.SeoActions) ? renderSeoActions : undefined}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Publishing Controls */}
          <div className="space-y-4">
            <PublishingControls
              status={formData.status}
              publishedAt={formData.publishedAt}
              onSave={handleSave}
              saving={saving}
              mode={mode}
              hasChanges={hasUnsavedChanges}
            />
            <div className="rounded-md border border-border bg-muted/40 p-3 text-center text-xs text-muted-foreground">
              {!hydrated
                ? 'Autosave enabled'
                : lastSavedAt
                  ? `Last saved ${lastSavedAt.toLocaleTimeString()}`
                  : autosaveTimestamp
                    ? `Last autosaved ${autosaveTimestamp.toLocaleTimeString()}`
                    : 'Autosave enabled'}
            </div>
          </div>

          {sidebarPanels}

          {/* Author Selection */}
          <div className="card p-4">
            <h4 className="font-semibold mb-3">Author</h4>
            <select
              value={formData.authorId}
              onChange={(e) => handleFieldChange('authorId', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md ${errors.authorId ? 'border-red-500' : 'border-input'}`}
            >
              <option value="">Select author...</option>
              {authors.map(author => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
            </select>
            {errors.authorId && <p className="text-destructive text-sm mt-1">{errors.authorId}</p>}
          </div>

          {/* Featured Image */}
          <div className="card p-4">
            <h4 className="font-semibold mb-3">Featured Image</h4>
            {formData.featuredImageId && formData.featuredImage ? (
              <div className="space-y-2">
                <div className="aspect-video bg-muted rounded-md overflow-hidden">
                  {formData.featuredImage?.mimeType?.startsWith('image/') ? (
                    <img
                      src={formData.featuredImage.url}
                      alt={formData.featuredImage.altText || 'Featured image'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      {formData.featuredImage?.filename || 'Selected asset'}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMediaManager(true);
                    }}
                    className="btn btn-outline flex-1"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFieldChange('featuredImageId', undefined);
                      handleFieldChange('featuredImage', null);
                    }}
                    className="btn btn-outline text-destructive"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowMediaManager(true);
                }}
                className="w-full py-8 border-2 border-dashed border-input rounded-md text-center hover:border-border transition-colors"
              >
                <div className="text-muted-foreground">
                  <div className="text-2xl mb-2">📷</div>
                  <div className="text-sm">Click to select image</div>
                </div>
              </button>
            )}
          </div>

          {formData.audioAsset && (
            <div className="card p-4">
              <h4 className="font-semibold mb-3">Audio Version</h4>
              <div className="space-y-3">
                <audio controls className="w-full">
                  <source src={formData.audioAsset.url} type={formData.audioAsset.mimeType} />
                </audio>
                <button
                  type="button"
                  onClick={() => {
                    handleFieldChange('audioAssetId', undefined);
                    handleFieldChange('audioAsset', null);
                  }}
                  className="btn btn-outline text-destructive w-full"
                >
                  Remove Audio
                </button>
              </div>
            </div>
          )}

          {/* Categories and Tags */}
          <CategoryTagSelector
            categories={categories}
            tags={tagOptions}
            selectedCategoryIds={formData.categoryIds}
            selectedTagIds={formData.tagIds}
            onCategoriesChange={(categoryIds) => handleFieldChange('categoryIds', categoryIds)}
            onTagsChange={(tagIds) => handleFieldChange('tagIds', tagIds)}
            onTagCreated={(tag) => setTagOptions((prev) => [...prev, tag])}
          />
        </div>
      </div>

      {/* Media Manager Modal */}
      {showMediaManager && (
        <MediaManager
          onSelect={handleMediaSelect}
          onClose={() => setShowMediaManager(false)}
        />
      )}
    </div>
  );
};

export default PostEditor;
