import React, { useState, useEffect, useRef } from 'react';
import { ToastProvider, useToast } from '@/lib/components/ui/toast';
import { Pencil, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import {
  AdminLoadingState,
  IconActionButton,
  ListingFilterField,
  ListingFiltersCard,
  ListingFiltersGrid,
  ListingStateRow,
  ListingTableCard,
  ListingTableScroller
} from '@/lib/components/admin/ListingPrimitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import type { CSSProperties } from 'react';

interface Tag {
  id: string;
  name: string;
  slug: string;
  postCount?: number;
  localizations?: {
    labels?: Record<string, string>;
  };
}

interface TagStats {
  totalTags: number;
  usedTags: number;
  unusedTags: number;
  averagePostsPerTag: number;
}

interface TagManagerProps {
  onClose?: () => void;
}

type ConfirmDialogState = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  confirmTone?: 'default' | 'destructive';
  onConfirm: () => Promise<void> | void;
};

export default function TagManager(props: TagManagerProps) {
  return (
    <ToastProvider>
      <TagManagerInner {...props} />
    </ToastProvider>
  );
}

function TagManagerInner({ onClose }: TagManagerProps) {
  const { toast } = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [supportedLocales, setSupportedLocales] = useState<string[]>(['en']);
  const [stats, setStats] = useState<TagStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    localizedLabels: {} as Record<string, string>
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewTagButton, setShowNewTagButton] = useState(true);
  const newTagButtonTimer = useRef<NodeJS.Timeout | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Load tags and stats
  const loadTags = async () => {
    try {
      setLoading(true);
      setStatsError(null);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);

      const [tagsResponse, statsResponse] = await Promise.all([
        fetch(`/api/admin/tags?${params}`),
        fetch('/api/admin/tags/stats')
      ]);

      if (tagsResponse.ok) {
        const tagsData = await tagsResponse.json();
        setTags(tagsData);
        setSelectedTagIds(prev => prev.filter(id => tagsData.some((tag: Tag) => tag.id === id)));
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      } else {
        setStats(null);
        setStatsError('Tag statistics are unavailable.');
      }
    } catch (error) {
      console.error('Error loading tags:', error);
      setStats(null);
      setStatsError('Tag statistics are unavailable.');
      toast({
        variant: 'destructive',
        title: 'Failed to load tags',
        description: 'Please refresh the page or try again shortly.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, [searchTerm]);

  useEffect(() => {
    const loadLocales = async () => {
      try {
        const response = await fetch('/api/admin/locales');
        if (!response.ok) return;
        const payload = await response.json();
        if (Array.isArray(payload?.activeLocales) && payload.activeLocales.length > 0) {
          setSupportedLocales(payload.activeLocales);
        }
      } catch {
        // Keep fallback
      }
    };

    void loadLocales();
  }, []);

  useEffect(() => {
    return () => {
      if (newTagButtonTimer.current) {
        clearTimeout(newTagButtonTimer.current);
      }
    };
  }, []);

  const unusedTags = tags.filter(tag => !tag.postCount || tag.postCount === 0);
  const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.id));
  const selectedUnusedTags = selectedTags.filter(tag => !tag.postCount || tag.postCount === 0);

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      const payload = {
        name: formData.name.trim(),
        slug: (formData.slug || generateSlug(formData.name)).trim(),
        localizations: {
          labels: formData.localizedLabels
        }
      };

      if (!payload.name || !payload.slug) {
        toast({
          variant: 'destructive',
          title: 'Missing information',
          description: 'Name and slug are required.',
        });
        return;
      }

      const url = editingTag
        ? `/api/admin/tags/${editingTag.id}`
        : '/api/admin/tags';

      const method = editingTag ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setShowForm(false);
        setEditingTag(null);
        setFormData({ name: '', slug: '', localizedLabels: {} });
        await loadTags();
        scheduleShowNewTagButton();
        toast({
          variant: 'success',
          title: editingTag ? 'Tag updated' : 'Tag created',
          description: editingTag
            ? `“${payload.name}” has been updated.`
            : `“${payload.name}” is now available in your tags list.`,
        });
      } else {
        const error = await response.json();
        toast({
          variant: 'destructive',
          title: 'Could not save tag',
          description: error.message || 'Please try again.',
        });
      }
    } catch (error) {
      console.error('Error saving tag:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to save tag',
        description: 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      slug: tag.slug,
      localizedLabels: tag.localizations?.labels || {}
    });
    hideNewTagButton();
    setShowForm(true);
  };

  // Handle delete
  const handleDelete = async (tag: Tag) => {
    if (tag.postCount && tag.postCount > 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot delete tag',
        description: `“${tag.name}” is used by ${tag.postCount} post${tag.postCount === 1 ? '' : 's'}.`,
      });
      return;
    }

    openConfirm({
      title: 'Delete tag',
      description: `This will permanently remove “${tag.name}”.`,
      confirmLabel: 'Delete tag',
      confirmTone: 'destructive',
      onConfirm: async () => {
        try {
          setConfirmBusy(true);
          const response = await fetch(`/api/admin/tags/${tag.id}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            await loadTags();
            scheduleShowNewTagButton();
            setSelectedTagIds(prev => prev.filter(id => id !== tag.id));
            toast({
              variant: 'success',
              title: 'Tag deleted',
              description: `“${tag.name}” has been removed.`,
            });
          } else {
            const error = await response.json();
            toast({
              variant: 'destructive',
              title: 'Could not delete tag',
              description: error.message || 'Please try again.',
            });
          }
        } catch (error) {
          console.error('Error deleting tag:', error);
          toast({
            variant: 'destructive',
            title: 'Failed to delete tag',
            description: 'Please try again.',
          });
        } finally {
          setConfirmBusy(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  const toggleTagSelection = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSelectAll = () => {
    setSelectedTagIds(tags.map(tag => tag.id));
  };

  const handleClearSelection = () => {
    setSelectedTagIds([]);
  };

  const handleBulkDelete = async () => {
    if (selectedTagIds.length === 0) return;

    if (selectedUnusedTags.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No unused tags selected',
        description: 'Deselect tags with posts to delete unused tags.',
      });
      return;
    }

    openConfirm({
      title: selectedUnusedTags.length === 1 ? 'Delete tag' : 'Delete tags',
      description:
        selectedUnusedTags.length === 1
          ? `This will permanently remove “${selectedUnusedTags[0].name}”.`
          : `This will permanently remove ${selectedUnusedTags.length} unused tags.`,
      confirmLabel:
        selectedUnusedTags.length === 1
          ? 'Delete tag'
          : `Delete ${selectedUnusedTags.length} tags`,
      confirmTone: 'destructive',
      onConfirm: async () => {
        try {
          setConfirmBusy(true);
          const response = await fetch('/api/admin/tags/bulk', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tagIds: selectedUnusedTags.map(tag => tag.id) }),
          });

          if (response.ok) {
            await loadTags();
            setSelectedTagIds([]);
            scheduleShowNewTagButton();
            toast({
              variant: 'success',
              title: 'Tags deleted',
              description: `${selectedUnusedTags.length} tag${selectedUnusedTags.length === 1 ? '' : 's'} removed.`,
            });
          } else {
            const error = await response.json();
            toast({
              variant: 'destructive',
              title: 'Could not delete tags',
              description: error.message || 'Please try again.',
            });
          }
        } catch (error) {
          console.error('Error deleting tags in bulk:', error);
          toast({
            variant: 'destructive',
            title: 'Failed to delete tags',
            description: 'Please try again.',
          });
        } finally {
          setConfirmBusy(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleOpenMergeDialog = () => {
    setMergeTargetId('');
    setShowMergeDialog(true);
  };

  const handleMergeTags = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeTargetId) {
      toast({
        variant: 'destructive',
        title: 'Select target tag',
        description: 'Choose a tag that will receive the merged posts.',
      });
      return;
    }

    const sourceTagIds = selectedTagIds.filter(id => id !== mergeTargetId);

    if (sourceTagIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Select tags to merge',
        description: 'Select at least one additional tag to merge into the target.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/admin/tags/merge', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTagId: mergeTargetId,
          sourceTagIds
        })
      });

      if (response.ok) {
        const result = await response.json();
        const mergedPosts = typeof result.mergedPosts === 'number' ? result.mergedPosts : 0;
        const deletedCount = Array.isArray(result.deletedTags) ? result.deletedTags.length : 0;
        toast({
          variant: 'success',
          title: 'Merge completed',
          description: `${mergedPosts} post${mergedPosts === 1 ? '' : 's'} moved, ${deletedCount} tag${deletedCount === 1 ? '' : 's'} deleted.`,
        });
        setShowMergeDialog(false);
        setSelectedTagIds([]);
        await loadTags();
        scheduleShowNewTagButton();
      } else {
        const error = await response.json();
        toast({
          variant: 'destructive',
          title: 'Tag merge failed',
          description: error.message || 'Please try again.',
        });
      }
    } catch (error) {
      console.error('Error merging tags:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to merge tags',
        description: 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUnusedTags = async () => {
    if (unusedTags.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No unused tags',
        description: 'All tags are currently in use.',
      });
      return;
    }

    openConfirm({
      title: unusedTags.length === 1 ? 'Delete unused tag' : 'Delete unused tags',
      description: `This will delete ${unusedTags.length} unused tag${unusedTags.length === 1 ? '' : 's'}.`,
      confirmLabel:
        unusedTags.length === 1
          ? 'Delete unused tag'
          : `Delete ${unusedTags.length} unused tags`,
      confirmTone: 'destructive',
      onConfirm: async () => {
        try {
          setConfirmBusy(true);
          const response = await fetch('/api/admin/tags/bulk', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tagIds: unusedTags.map(tag => tag.id) }),
          });

          if (response.ok) {
            setShowCleanupDialog(false);
            setSelectedTagIds(prev => prev.filter(id => !unusedTags.some(tag => tag.id === id)));
            await loadTags();
            scheduleShowNewTagButton();
            toast({
              variant: 'success',
              title: 'Unused tags deleted',
              description: `${unusedTags.length} tag${unusedTags.length === 1 ? '' : 's'} removed.`,
            });
          } else {
            const error = await response.json();
            toast({
              variant: 'destructive',
              title: 'Cleanup failed',
              description: error.message || 'Please try again.',
            });
          }
        } catch (error) {
          console.error('Error deleting unused tags:', error);
          toast({
            variant: 'destructive',
            title: 'Failed to delete unused tags',
            description: 'Please try again.',
          });
        } finally {
          setConfirmBusy(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  // Cancel form
  const handleCancel = () => {
    setShowForm(false);
    setEditingTag(null);
    setFormData({ name: '', slug: '', localizedLabels: {} });
    scheduleShowNewTagButton();
  };

  const hideNewTagButton = () => {
    if (newTagButtonTimer.current) {
      clearTimeout(newTagButtonTimer.current);
      newTagButtonTimer.current = null;
    }
    setShowNewTagButton(false);
  };

  const scheduleShowNewTagButton = (delay = 0) => {
    if (newTagButtonTimer.current) {
      clearTimeout(newTagButtonTimer.current);
    }
    newTagButtonTimer.current = setTimeout(() => {
      setShowNewTagButton(true);
      newTagButtonTimer.current = null;
    }, delay);
  };

  const handleNewTagClick = () => {
    setEditingTag(null);
    setFormData({ name: '', slug: '', localizedLabels: {} });
    hideNewTagButton();
    setShowForm(true);
  };

  const openConfirm = (config: Omit<ConfirmDialogState, 'open'>) => {
    setConfirmBusy(false);
    setConfirmDialog({ ...config, open: true });
  };

  const visuallyHidden: CSSProperties = {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
    border: 0,
  };

  const loadingBanner = loading ? (
    <AdminLoadingState label="Loading tags..." className="p-6" />
  ) : null;

  return (
    <div className="space-y-6">
      {loadingBanner}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {stats ? `${stats.totalTags} total tags` : `${tags.length} tag${tags.length === 1 ? '' : 's'}`}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowCleanupDialog(true)} className="btn btn-outline">
            <Sparkles className="mr-2 h-4 w-4" />
            Cleanup
          </button>
          <button onClick={() => loadTags()} className="btn btn-outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
          {showNewTagButton && (
            <button
              onClick={handleNewTagClick}
              className="btn btn-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Tag
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="btn btn-outline">
              Close
            </button>
          )}
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Tags</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{stats.totalTags}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Used Tags</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{stats.usedTags}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Unused Tags</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{stats.unusedTags}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Avg Posts/Tag</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{stats.averagePostsPerTag}</p>
          </div>
        </div>
      )}
      {statsError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {statsError}
        </div>
      )}

      <ListingFiltersCard>
        <ListingFiltersGrid columnsClassName="grid-cols-1 md:grid-cols-[1fr_auto]">
          <ListingFilterField label="Search" htmlFor="tag-search">
            <input
              id="tag-search"
              type="text"
              placeholder="Search tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
            />
          </ListingFilterField>
          <div className="flex items-end text-sm text-muted-foreground">
            {tags.length} tag{tags.length !== 1 ? 's' : ''}
          </div>
        </ListingFiltersGrid>
      </ListingFiltersCard>

      {/* Bulk actions */}
      {selectedTagIds.length > 0 && (
        <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium">
            {selectedTagIds.length} selected
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleSelectAll} className="btn btn-outline btn-sm">
              Select All
            </button>
            <button onClick={handleClearSelection} className="btn btn-outline btn-sm">
              Clear
            </button>
            {selectedTagIds.length >= 2 && (
              <button onClick={handleOpenMergeDialog} className="btn btn-secondary btn-sm">
                <span className="hidden sm:inline">Merge Selected</span>
                <span className="sm:hidden">Merge</span>
              </button>
            )}
            <button
              onClick={handleBulkDelete}
              className="btn btn-destructive btn-sm"
              disabled={selectedUnusedTags.length === 0 || confirmBusy}
            >
              <span>Delete</span>
              <span aria-hidden="true"> Selected ({selectedUnusedTags.length})</span>
              <span style={visuallyHidden}>{`Delete Selected (${selectedUnusedTags.length})`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingTag ? 'Edit Tag' : 'New Tag'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      name,
                      slug: prev.slug || generateSlug(name)
                    }));
                  }}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  required
                />
              </div>
              <div>
                <label htmlFor="slug" className="block text-sm font-medium mb-1">
                  Slug *
                </label>
                <input
                  id="slug"
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  required
                />
              </div>
            </div>
            {supportedLocales.filter((locale) => locale !== 'en').length > 0 && (
              <div className="rounded-xl border border-border/60 p-4">
                <p className="text-sm font-semibold text-foreground">Localized versions</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add translated tag labels for active locales.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {supportedLocales.filter((locale) => locale !== 'en').map((locale) => (
                    <div key={locale}>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        {locale} label
                      </label>
                      <input
                        type="text"
                        value={formData.localizedLabels[locale] || ''}
                        onChange={(event) => setFormData((prev) => ({
                          ...prev,
                          localizedLabels: { ...prev.localizedLabels, [locale]: event.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-input rounded-md"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting} aria-disabled={isSubmitting}>
                {editingTag ? 'Update Tag' : 'Create Tag'}
              </button>
              <button type="button" onClick={handleCancel} className="btn btn-outline">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <ListingTableCard>
        <ListingTableScroller>
          <table className="w-full min-w-full text-sm">
            <thead className="border-b border-border bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Select</th>
                <th className="px-4 py-3 text-left">Tag</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Slug</th>
                <th className="px-4 py-3 text-left">Posts</th>
                <th className="px-4 py-3 text-right sm:px-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-card">
              {tags.map((tag) => {
                const postCount = tag.postCount || 0;
                const unused = postCount === 0;
                return (
                  <tr key={tag.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${tag.name}`}
                        checked={selectedTagIds.includes(tag.id)}
                        onChange={() => toggleTagSelection(tag.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{tag.name}</div>
                      <div className="text-xs text-muted-foreground md:hidden">/{tag.slug}</div>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">/{tag.slug}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        {postCount} post{postCount !== 1 ? 's' : ''}
                      </span>
                      {unused && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          unused
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-6">
                      <div className="inline-flex items-center gap-2">
                        <IconActionButton
                          title="Edit Tag"
                          onClick={() => handleEdit(tag)}
                          icon={<Pencil className="h-3.5 w-3.5" />}
                        />
                        <IconActionButton
                          title="Delete Tag"
                          ariaLabel={`Open delete dialog for tag ${tag.name}`}
                          onClick={() => handleDelete(tag)}
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          destructive
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {tags.length === 0 && !loading && (
                <ListingStateRow colSpan={5} text="No tags found" />
              )}
            </tbody>
          </table>
        </ListingTableScroller>
        {tags.length === 0 && !loading && (
          <div className="border-t border-border/60 px-4 py-4 text-sm text-muted-foreground">
            <p>{searchTerm ? 'Try a different search term' : 'Create your first tag to label your content'}</p>
            {!searchTerm && (
              <button
                onClick={() => setShowForm(true)}
                className="btn btn-primary mt-3"
                type="button"
              >
                Create First Tag
              </button>
            )}
          </div>
        )}
      </ListingTableCard>

      <Dialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <DialogContent className="max-w-lg" aria-labelledby="cleanup-dialog-title">
          <DialogHeader>
            <DialogTitle id="cleanup-dialog-title">Tag Cleanup</DialogTitle>
            <DialogDescription>
              Analyze unused tags and remove them to keep your taxonomy organized.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-dashed border-muted p-4">
            <div className="text-sm font-medium">Unused tags</div>
            <div className="text-2xl font-bold">{unusedTags.length}</div>
            {unusedTags.length > 0 ? (
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                {unusedTags.map(tag => (
                  <li key={tag.id}>{tag.name}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No unused tags detected. Great job!
              </p>
            )}
          </div>
          <DialogFooter>
            <button
              onClick={handleDeleteUnusedTags}
              className="btn btn-destructive"
              disabled={isSubmitting || unusedTags.length === 0}
            >
              Delete Unused Tags
            </button>
            <button
              type="button"
              onClick={() => setShowCleanupDialog(false)}
              className="btn btn-outline"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="max-w-xl" aria-labelledby="merge-dialog-title">
          <form onSubmit={handleMergeTags}>
            <DialogHeader>
              <DialogTitle id="merge-dialog-title">Merge Tags</DialogTitle>
              <DialogDescription>
                Select the target tag to merge the selected tags into. Posts using the source tags will move to the target tag.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label htmlFor="target-tag" className="mb-1 block text-sm font-medium">
                  Target tag
                </label>
                <select
                  id="target-tag"
                  value={mergeTargetId}
                  onChange={(event) => setMergeTargetId(event.target.value)}
                  className="w-full rounded-md border border-input px-3 py-2"
                >
                  <option value="">Select target tag...</option>
                  {tags.map(tag => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedTags.length > 0 && (
                <div className="rounded-lg border border-dashed border-muted p-4">
                  <div className="mb-2 text-sm font-medium">Tags to merge</div>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {selectedTags.map(tag => (
                      <li key={tag.id}>{tag.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                aria-label="Merge Tags"
              >
                Confirm Merge
              </button>
              <button
                type="button"
                onClick={() => setShowMergeDialog(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(confirmDialog?.open)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmBusy(false);
            setConfirmDialog(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title || 'Confirm action'}</DialogTitle>
            {confirmDialog?.description ? (
              <DialogDescription>{confirmDialog.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setConfirmBusy(false);
                setConfirmDialog(null);
              }}
              disabled={confirmBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${confirmDialog?.confirmTone === 'destructive' ? 'btn-destructive' : 'btn-primary'}`}
              onClick={async () => {
                if (!confirmDialog?.onConfirm) return;
                try {
                  setConfirmBusy(true);
                  await confirmDialog.onConfirm();
                } catch (error) {
                  console.error('Confirmation action failed:', error);
                  toast({
                    variant: 'destructive',
                    title: 'Action failed',
                    description: 'Please try again.',
                  });
                } finally {
                  setConfirmBusy(false);
                }
              }}
              disabled={confirmBusy}
              aria-busy={confirmBusy}
            >
              {confirmBusy ? 'Working...' : confirmDialog?.confirmLabel || 'Confirm'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
