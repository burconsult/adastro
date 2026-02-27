import React, { useState, useCallback, useEffect } from 'react';
import type { SEOMetadata, OpenGraphData, TwitterCardData } from '../types/index.js';

interface SEOMetadataEditorProps {
  metadata: SEOMetadata;
  onChange: (metadata: SEOMetadata) => void;
  postTitle: string;
  postExcerpt: string;
  postContent?: string;
  postTags?: string[];
  previewPathTemplate?: string;
  actions?: (controls: { disableAutoGenerate: () => void; autoGenerate: boolean }) => React.ReactNode;
}

export const SEOMetadataEditor: React.FC<SEOMetadataEditorProps> = ({
  metadata,
  onChange,
  postTitle,
  postExcerpt,
  postContent = '',
  postTags = [],
  previewPathTemplate = '/articles/{slug}/',
  actions
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(true);

  // Auto-generate SEO fields from post data
  useEffect(() => {
    if (!autoGenerate) return;

    const titleFallback = postTitle?.trim().slice(0, 60) || '';
    const descriptionFallback = postExcerpt?.trim().slice(0, 160) || '';
    const twitterTitle = postTitle?.trim().slice(0, 70) || titleFallback;
    const twitterDescription = postExcerpt?.trim().slice(0, 200) || descriptionFallback;

    const nextMetadata: SEOMetadata = {
      ...metadata,
      metaTitle: titleFallback,
      metaDescription: descriptionFallback,
      openGraph: {
        ...(metadata.openGraph ?? {}),
        title: titleFallback,
        description: descriptionFallback,
        type: 'article'
      },
      twitterCard: {
        ...(metadata.twitterCard ?? {}),
        title: twitterTitle,
        description: twitterDescription,
        card: 'summary_large_image'
      }
    };

    const unchanged =
      metadata.metaTitle === nextMetadata.metaTitle &&
      metadata.metaDescription === nextMetadata.metaDescription &&
      metadata.openGraph?.title === nextMetadata.openGraph?.title &&
      metadata.openGraph?.description === nextMetadata.openGraph?.description &&
      metadata.twitterCard?.title === nextMetadata.twitterCard?.title &&
      metadata.twitterCard?.description === nextMetadata.twitterCard?.description &&
      metadata.twitterCard?.card === nextMetadata.twitterCard?.card;

    if (!unchanged) {
      onChange(nextMetadata);
    }
  }, [autoGenerate, postTitle, postExcerpt, metadata, onChange]);

  const handleFieldChange = useCallback((field: keyof SEOMetadata, value: any) => {
    onChange({
      ...metadata,
      [field]: value
    });
  }, [metadata, onChange]);

  const handleOpenGraphChange = useCallback((field: keyof OpenGraphData, value: any) => {
    onChange({
      ...metadata,
      openGraph: {
        ...metadata.openGraph,
        [field]: value
      }
    });
  }, [metadata, onChange]);

  const handleTwitterCardChange = useCallback((field: keyof TwitterCardData, value: any) => {
    onChange({
      ...metadata,
      twitterCard: {
        ...metadata.twitterCard,
        [field]: value
      }
    });
  }, [metadata, onChange]);

  const getCharacterCount = (text: string, limit: number) => {
    const count = text?.length || 0;
    const isOverLimit = count > limit;
    return (
      <span className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
        {count}/{limit}
      </span>
    );
  };

  const slugPreview = (postTitle || 'post-title')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'post-title';

  const resolvedPreviewPath = (() => {
    const normalizedTemplate = (previewPathTemplate || '/articles/{slug}/').trim() || '/articles/{slug}/';
    const withLeadingSlash = normalizedTemplate.startsWith('/') ? normalizedTemplate : `/${normalizedTemplate}`;
    return withLeadingSlash.includes('{slug}')
      ? withLeadingSlash.replaceAll('{slug}', slugPreview)
      : withLeadingSlash;
  })();

  return (
    <div className="seo-metadata-editor space-y-4">
      {/* Auto-generate toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={autoGenerate}
            onChange={(e) => setAutoGenerate(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">Auto-generate from post content</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {actions
            ? actions({
                disableAutoGenerate: () => setAutoGenerate(false),
                autoGenerate
              })
            : null}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-primary hover:underline"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
          </button>
        </div>
      </div>

      {/* Basic SEO Fields */}
      <div className="space-y-4">
        <div>
          <label htmlFor="metaTitle" className="block text-sm font-medium mb-1">
            Meta Title
          </label>
          <div className="space-y-1">
            <input
              id="metaTitle"
              type="text"
              value={metadata.metaTitle || ''}
              onChange={(e) => handleFieldChange('metaTitle', e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm"
              placeholder="SEO title for search engines"
              disabled={autoGenerate}
            />
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">
                Appears in search engine results
              </span>
              {getCharacterCount(metadata.metaTitle || '', 60)}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="metaDescription" className="block text-sm font-medium mb-1">
            Meta Description
          </label>
          <div className="space-y-1">
            <textarea
              id="metaDescription"
              value={metadata.metaDescription || ''}
              onChange={(e) => handleFieldChange('metaDescription', e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm"
              rows={3}
              placeholder="Brief description for search engines"
              disabled={autoGenerate}
            />
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">
                Appears in search engine results
              </span>
              {getCharacterCount(metadata.metaDescription || '', 160)}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t border-border">
          {/* Canonical URL */}
          <div>
            <label htmlFor="canonicalUrl" className="block text-sm font-medium mb-1">
              Canonical URL
            </label>
            <input
              id="canonicalUrl"
              type="url"
              value={metadata.canonicalUrl || ''}
              onChange={(e) => handleFieldChange('canonicalUrl', e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm"
              placeholder="https://example.com/canonical-url"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Specify the preferred URL for this content
            </p>
          </div>

          {/* Robots Settings */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={metadata.noIndex || false}
                onChange={(e) => handleFieldChange('noIndex', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">No Index</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={metadata.noFollow || false}
                onChange={(e) => handleFieldChange('noFollow', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">No Follow</span>
            </label>
          </div>

          {/* Open Graph Settings */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Open Graph (Facebook)</h4>
            
            <div>
              <label htmlFor="ogTitle" className="block text-sm font-medium mb-1">
                OG Title
              </label>
              <div className="space-y-1">
                <input
                  id="ogTitle"
                  type="text"
                  value={metadata.openGraph?.title || ''}
                  onChange={(e) => handleOpenGraphChange('title', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md text-sm"
                  placeholder="Title for social media sharing"
                  disabled={autoGenerate}
                />
                {getCharacterCount(metadata.openGraph?.title || '', 60)}
              </div>
            </div>

            <div>
              <label htmlFor="ogDescription" className="block text-sm font-medium mb-1">
                OG Description
              </label>
              <div className="space-y-1">
                <textarea
                  id="ogDescription"
                  value={metadata.openGraph?.description || ''}
                  onChange={(e) => handleOpenGraphChange('description', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md text-sm"
                  rows={2}
                  placeholder="Description for social media sharing"
                  disabled={autoGenerate}
                />
                {getCharacterCount(metadata.openGraph?.description || '', 160)}
              </div>
            </div>

            <div>
              <label htmlFor="ogImage" className="block text-sm font-medium mb-1">
                OG Image URL
              </label>
              <input
                id="ogImage"
                type="url"
                value={metadata.openGraph?.image || ''}
                onChange={(e) => handleOpenGraphChange('image', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>

          {/* Twitter Card Settings */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Twitter Card</h4>
            
            <div>
              <label htmlFor="twitterCard" className="block text-sm font-medium mb-1">
                Card Type
              </label>
              <select
                id="twitterCard"
                value={metadata.twitterCard?.card || 'summary_large_image'}
                onChange={(e) => handleTwitterCardChange('card', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm"
              >
                <option value="summary">Summary</option>
                <option value="summary_large_image">Summary Large Image</option>
              </select>
            </div>

            <div>
              <label htmlFor="twitterTitle" className="block text-sm font-medium mb-1">
                Twitter Title
              </label>
              <div className="space-y-1">
                <input
                  id="twitterTitle"
                  type="text"
                  value={metadata.twitterCard?.title || ''}
                  onChange={(e) => handleTwitterCardChange('title', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md text-sm"
                  placeholder="Title for Twitter sharing"
                  disabled={autoGenerate}
                />
                {getCharacterCount(metadata.twitterCard?.title || '', 70)}
              </div>
            </div>

            <div>
              <label htmlFor="twitterDescription" className="block text-sm font-medium mb-1">
                Twitter Description
              </label>
              <div className="space-y-1">
                <textarea
                  id="twitterDescription"
                  value={metadata.twitterCard?.description || ''}
                  onChange={(e) => handleTwitterCardChange('description', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md text-sm"
                  rows={2}
                  placeholder="Description for Twitter sharing"
                  disabled={autoGenerate}
                />
                {getCharacterCount(metadata.twitterCard?.description || '', 200)}
              </div>
            </div>

            <div>
              <label htmlFor="twitterImage" className="block text-sm font-medium mb-1">
                Twitter Image URL
              </label>
              <input
                id="twitterImage"
                type="url"
                value={metadata.twitterCard?.image || ''}
                onChange={(e) => handleTwitterCardChange('image', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>
        </div>
      )}

      {/* SEO Preview */}
      <div className="mt-6 p-4 bg-muted/60 rounded-md">
        <h4 className="font-medium text-sm mb-3">Search Engine Preview</h4>
        <div className="space-y-2">
          <div className="text-primary text-lg hover:underline cursor-pointer">
            {metadata.metaTitle || postTitle || 'Post Title'}
          </div>
          <div className="text-success text-sm">
            https://yoursite.com{resolvedPreviewPath}
          </div>
          <div className="text-muted-foreground text-sm">
            {metadata.metaDescription || postExcerpt || 'Post description will appear here...'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SEOMetadataEditor;
