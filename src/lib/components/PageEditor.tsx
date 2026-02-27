import React, { useCallback, useMemo, useState } from 'react';
import { ToastProvider, useToast } from '@/lib/components/ui/toast';
import { EditorJSEditor } from '@/lib/components/EditorJSEditor';
import { SEOMetadataEditor } from '@/lib/components/SEOMetadataEditor';
import { normalizeEditorJsData } from '@/lib/editorjs';
import { generateSlug } from '@/lib/utils/data-transform';
import type { Author, Page, SEOMetadata } from '@/lib/types';
import type { EditorJSData } from '@/lib/editorjs/types';

type PageStatus = 'draft' | 'published' | 'archived';
type PageTemplate = 'default' | 'home' | 'landing' | 'blog';
type SectionType = 'hero' | 'info_blocks' | 'feature_grid' | 'cta';

type SectionDefinition = {
  id?: string;
  type: SectionType;
  content: Record<string, any>;
  orderIndex: number;
};

interface PageEditorProps {
  page?: Page;
  authors: Author[];
  mode: 'create' | 'edit';
}

interface PageFormData {
  title: string;
  slug: string;
  status: PageStatus;
  template: PageTemplate;
  blocks: EditorJSData;
  excerpt: string;
  authorId?: string;
  seoMetadata: SEOMetadata;
  sections: SectionDefinition[];
}

const TEMPLATE_OPTIONS: { value: PageTemplate; label: string; description: string }[] = [
  { value: 'default', label: 'Default', description: 'Rich content blocks and simple layout.' },
  { value: 'home', label: 'Home', description: 'Hero-led layout with reusable sections.' },
  { value: 'landing', label: 'Landing', description: 'CTA-focused marketing layout.' },
  { value: 'blog', label: 'Blog', description: 'Blog index layout with optional hero content.' }
];

const SECTION_OPTIONS: { value: SectionType; label: string; description: string }[] = [
  { value: 'hero', label: 'Hero + CTA', description: 'Headline, subheading, and primary CTA.' },
  { value: 'info_blocks', label: 'Info blocks', description: 'Short highlights in a grid.' },
  { value: 'feature_grid', label: 'Feature grid', description: 'Detailed features with badges.' },
  { value: 'cta', label: 'CTA banner', description: 'Final call to action.' }
];

const createDefaultSection = (type: SectionType, orderIndex: number): SectionDefinition => {
  switch (type) {
    case 'hero':
      return {
        type,
        orderIndex,
        content: {
          label: 'Hero',
          heading: 'Design a hero section',
          subheading: 'Add a short supporting message.',
          primaryCtaLabel: 'Get started',
          primaryCtaHref: '/',
          secondaryCtaLabel: 'Learn more',
          secondaryCtaHref: '/',
          imageUrl: '',
          imageAlt: ''
        }
      };
    case 'info_blocks':
      return {
        type,
        orderIndex,
        content: {
          heading: 'Info blocks',
          items: [
            { title: 'Highlight one', description: 'Add a short detail.' },
            { title: 'Highlight two', description: 'Add a short detail.' },
            { title: 'Highlight three', description: 'Add a short detail.' }
          ]
        }
      };
    case 'feature_grid':
      return {
        type,
        orderIndex,
        content: {
          heading: 'Feature grid',
          items: [
            { title: 'Feature one', description: 'Explain the benefit.', badge: 'New' },
            { title: 'Feature two', description: 'Explain the benefit.', badge: 'Core' }
          ]
        }
      };
    case 'cta':
    default:
      return {
        type: 'cta',
        orderIndex,
        content: {
          heading: 'Ready to continue?',
          body: 'Add a CTA that closes the page.',
          ctaLabel: 'Contact us',
          ctaHref: '/contact'
        }
      };
  }
};

export const PageEditor: React.FC<PageEditorProps> = (props) => (
  <ToastProvider>
    <PageEditorInner {...props} />
  </ToastProvider>
);

const PageEditorInner: React.FC<PageEditorProps> = ({ page, authors, mode }) => {
  const { toast } = useToast();
  const normalizedPage = useMemo(() => {
    if (!page) return undefined;
    return {
      ...page,
      blocks: normalizeEditorJsData(page.contentBlocks ?? {})
    };
  }, [page]);

  const [formData, setFormData] = useState<PageFormData>(() => ({
    title: normalizedPage?.title || '',
    slug: normalizedPage?.slug || '',
    status: normalizedPage?.status || 'draft',
    template: (normalizedPage?.template as PageTemplate) || 'default',
    blocks: normalizedPage?.blocks ?? { blocks: [] },
    excerpt: normalizedPage?.excerpt || '',
    authorId: normalizedPage?.author?.id || authors[0]?.id,
    seoMetadata: normalizedPage?.seoMetadata || {},
    sections: (normalizedPage?.sections || []).map((section, index) => ({
      id: section.id,
      type: section.type as SectionType,
      content: section.content || {},
      orderIndex: section.orderIndex ?? index
    }))
  }));

  const [slugDirty, setSlugDirty] = useState(Boolean(normalizedPage?.slug));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectionType, setSectionType] = useState<SectionType>('hero');

  const updateField = useCallback((key: keyof PageFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const updateSection = useCallback((index: number, content: Record<string, any>) => {
    setFormData((prev) => {
      const next = [...prev.sections];
      next[index] = { ...next[index], content };
      return { ...prev, sections: next };
    });
  }, []);

  const addSection = () => {
    setFormData((prev) => {
      const next = [
        ...prev.sections,
        createDefaultSection(sectionType, prev.sections.length)
      ];
      return { ...prev, sections: next };
    });
  };

  const removeSection = (index: number) => {
    setFormData((prev) => {
      const next = prev.sections.filter((_, idx) => idx !== index);
      return { ...prev, sections: next.map((section, idx) => ({ ...section, orderIndex: idx })) };
    });
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    setFormData((prev) => {
      const next = [...prev.sections];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return { ...prev, sections: next.map((section, idx) => ({ ...section, orderIndex: idx })) };
    });
  };

  const handleTitleChange = (value: string) => {
    updateField('title', value);
    if (!slugDirty) {
      updateField('slug', generateSlug(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugDirty(true);
    updateField('slug', generateSlug(value));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!formData.title.trim() || !formData.slug.trim()) {
        throw new Error('Title and slug are required.');
      }

      const payload = {
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        status: formData.status,
        template: formData.template,
        blocks: formData.blocks,
        excerpt: formData.excerpt,
        authorId: formData.authorId,
        seoMetadata: formData.seoMetadata,
        sections: formData.sections.map((section, index) => ({
          id: section.id,
          type: section.type,
          content: section.content,
          orderIndex: index
        }))
      };

      const response = await fetch(
        mode === 'edit' && page ? `/api/admin/pages/${page.id}` : '/api/admin/pages',
        {
          method: mode === 'edit' ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.message || 'Failed to save page');
      }

      const saved = await response.json();
      toast({
        variant: 'success',
        title: mode === 'edit' ? 'Page updated' : 'Page created',
        description: `${saved.title} is saved.`
      });

      if (mode === 'create' && saved?.id) {
        window.location.href = `/admin/pages/edit/${saved.id}`;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save page';
      setError(message);
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: message
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="page-title">
              Title
            </label>
            <input
              id="page-title"
              type="text"
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Page title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="page-slug">
              Slug
            </label>
            <input
              id="page-slug"
              type="text"
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
              value={formData.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="page-slug"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="page-template">
              Template
            </label>
            <select
              id="page-template"
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
              value={formData.template}
              onChange={(e) => updateField('template', e.target.value as PageTemplate)}
            >
              {TEMPLATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              {TEMPLATE_OPTIONS.find((option) => option.value === formData.template)?.description}
            </p>
          </div>
        </div>

        {formData.template === 'default' ? (
          <div className="card p-6 space-y-4">
            <h2 className="text-base font-semibold">Content</h2>
            <EditorJSEditor data={formData.blocks} onChange={(data) => updateField('blocks', data)} />
          </div>
        ) : (
          <div className="card p-6 space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Page Sections</h2>
                <p className="text-xs text-muted-foreground">
                  Build the layout using reusable sections.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={sectionType}
                  onChange={(e) => setSectionType(e.target.value as SectionType)}
                  className="rounded-md border border-input px-3 py-2 text-sm"
                >
                  {SECTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-outline" onClick={addSection}>
                  Add section
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {formData.sections.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Add a section to start building this page.
                </p>
              )}

              {formData.sections.map((section, index) => (
                <div key={`${section.type}-${index}`} className="rounded-2xl border border-border p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {SECTION_OPTIONS.find((option) => option.value === section.type)?.label}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {SECTION_OPTIONS.find((option) => option.value === section.type)?.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => moveSection(index, -1)}>
                        ↑
                      </button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => moveSection(index, 1)}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm text-destructive"
                        onClick={() => removeSection(index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {section.type === 'hero' && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-muted-foreground">Label</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                          value={section.content.label || ''}
                          onChange={(e) => updateSection(index, { ...section.content, label: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-muted-foreground">Heading</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                          value={section.content.heading || ''}
                          onChange={(e) => updateSection(index, { ...section.content, heading: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold uppercase text-muted-foreground">Subheading</label>
                        <textarea
                          rows={3}
                          className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                          value={section.content.subheading || ''}
                          onChange={(e) => updateSection(index, { ...section.content, subheading: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-muted-foreground">Hero image URL</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                          placeholder="/images/your-image.svg"
                          value={section.content.imageUrl || ''}
                          onChange={(e) => updateSection(index, { ...section.content, imageUrl: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-muted-foreground">Hero image alt</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                          placeholder="Describe the image"
                          value={section.content.imageAlt || ''}
                          onChange={(e) => updateSection(index, { ...section.content, imageAlt: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-muted-foreground">Primary CTA</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                          placeholder="Label"
                          value={section.content.primaryCtaLabel || ''}
                          onChange={(e) => updateSection(index, { ...section.content, primaryCtaLabel: e.target.value })}
                        />
                        <input
                          type="text"
                          className="mt-2 w-full rounded-md border border-input px-3 py-2 text-sm"
                          placeholder="URL"
                          value={section.content.primaryCtaHref || ''}
                          onChange={(e) => updateSection(index, { ...section.content, primaryCtaHref: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-muted-foreground">Secondary CTA</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                          placeholder="Label"
                          value={section.content.secondaryCtaLabel || ''}
                          onChange={(e) => updateSection(index, { ...section.content, secondaryCtaLabel: e.target.value })}
                        />
                        <input
                          type="text"
                          className="mt-2 w-full rounded-md border border-input px-3 py-2 text-sm"
                          placeholder="URL"
                          value={section.content.secondaryCtaHref || ''}
                          onChange={(e) => updateSection(index, { ...section.content, secondaryCtaHref: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {section.type === 'info_blocks' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-muted-foreground">Heading</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                          value={section.content.heading || ''}
                          onChange={(e) => updateSection(index, { ...section.content, heading: e.target.value })}
                        />
                      </div>
                      <div className="space-y-3">
                        {(section.content.items || []).map((item: any, itemIndex: number) => (
                          <div key={itemIndex} className="rounded-lg border border-border/60 p-3">
                            <input
                              type="text"
                              className="w-full rounded-md border border-input px-3 py-2 text-sm"
                              placeholder="Title"
                              value={item.title || ''}
                              onChange={(e) => {
                                const items = [...(section.content.items || [])];
                                items[itemIndex] = { ...items[itemIndex], title: e.target.value };
                                updateSection(index, { ...section.content, items });
                              }}
                            />
                            <textarea
                              rows={2}
                              className="mt-2 w-full rounded-md border border-input px-3 py-2 text-sm"
                              placeholder="Description"
                              value={item.description || ''}
                              onChange={(e) => {
                                const items = [...(section.content.items || [])];
                                items[itemIndex] = { ...items[itemIndex], description: e.target.value };
                                updateSection(index, { ...section.content, items });
                              }}
                            />
                            <button
                              type="button"
                              className="mt-2 text-xs text-destructive"
                              onClick={() => {
                                const items = [...(section.content.items || [])].filter((_: any, idx: number) => idx !== itemIndex);
                                updateSection(index, { ...section.content, items });
                              }}
                            >
                              Remove item
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            const items = [...(section.content.items || [])];
                            items.push({ title: '', description: '' });
                            updateSection(index, { ...section.content, items });
                          }}
                        >
                          Add block
                        </button>
                      </div>
                    </div>
                  )}

                  {section.type === 'feature_grid' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-muted-foreground">Heading</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                          value={section.content.heading || ''}
                          onChange={(e) => updateSection(index, { ...section.content, heading: e.target.value })}
                        />
                      </div>
                      <div className="space-y-3">
                        {(section.content.items || []).map((item: any, itemIndex: number) => (
                          <div key={itemIndex} className="rounded-lg border border-border/60 p-3">
                            <input
                              type="text"
                              className="w-full rounded-md border border-input px-3 py-2 text-sm"
                              placeholder="Title"
                              value={item.title || ''}
                              onChange={(e) => {
                                const items = [...(section.content.items || [])];
                                items[itemIndex] = { ...items[itemIndex], title: e.target.value };
                                updateSection(index, { ...section.content, items });
                              }}
                            />
                            <textarea
                              rows={2}
                              className="mt-2 w-full rounded-md border border-input px-3 py-2 text-sm"
                              placeholder="Description"
                              value={item.description || ''}
                              onChange={(e) => {
                                const items = [...(section.content.items || [])];
                                items[itemIndex] = { ...items[itemIndex], description: e.target.value };
                                updateSection(index, { ...section.content, items });
                              }}
                            />
                            <input
                              type="text"
                              className="mt-2 w-full rounded-md border border-input px-3 py-2 text-sm"
                              placeholder="Badge"
                              value={item.badge || ''}
                              onChange={(e) => {
                                const items = [...(section.content.items || [])];
                                items[itemIndex] = { ...items[itemIndex], badge: e.target.value };
                                updateSection(index, { ...section.content, items });
                              }}
                            />
                            <button
                              type="button"
                              className="mt-2 text-xs text-destructive"
                              onClick={() => {
                                const items = [...(section.content.items || [])].filter((_: any, idx: number) => idx !== itemIndex);
                                updateSection(index, { ...section.content, items });
                              }}
                            >
                              Remove item
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            const items = [...(section.content.items || [])];
                            items.push({ title: '', description: '', badge: '' });
                            updateSection(index, { ...section.content, items });
                          }}
                        >
                          Add feature
                        </button>
                      </div>
                    </div>
                  )}

                  {section.type === 'cta' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-muted-foreground">Heading</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                          value={section.content.heading || ''}
                          onChange={(e) => updateSection(index, { ...section.content, heading: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-muted-foreground">Body</label>
                        <textarea
                          rows={3}
                          className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                          value={section.content.body || ''}
                          onChange={(e) => updateSection(index, { ...section.content, body: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <input
                          type="text"
                          className="rounded-md border border-input px-3 py-2 text-sm"
                          placeholder="CTA label"
                          value={section.content.ctaLabel || ''}
                          onChange={(e) => updateSection(index, { ...section.content, ctaLabel: e.target.value })}
                        />
                        <input
                          type="text"
                          className="rounded-md border border-input px-3 py-2 text-sm"
                          placeholder="CTA URL"
                          value={section.content.ctaHref || ''}
                          onChange={(e) => updateSection(index, { ...section.content, ctaHref: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card p-6 space-y-4">
          <h2 className="text-base font-semibold">SEO Metadata</h2>
          <SEOMetadataEditor
            metadata={formData.seoMetadata}
            onChange={(metadata) => updateField('seoMetadata', metadata)}
            postTitle={formData.title}
            postExcerpt={formData.excerpt}
            postContent=""
            previewPathTemplate={`/${(formData.slug || '{slug}').replace(/^\/+|\/+$/g, '')}`}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground">Status</label>
            <select
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
              value={formData.status}
              onChange={(e) => updateField('status', e.target.value as PageStatus)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">Author</label>
            <select
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
              value={formData.authorId || ''}
              onChange={(e) => updateField('authorId', e.target.value)}
            >
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">Excerpt</label>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
              value={formData.excerpt}
              onChange={(e) => updateField('excerpt', e.target.value)}
              placeholder="Short summary for listings"
            />
          </div>

          <button type="button" className="btn btn-primary w-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Create page'}
          </button>
        </div>
      </div>
    </div>
  );
};
