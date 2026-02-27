import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ToastProvider, useToast } from '@/lib/components/ui/toast';
import { buildArticlePostPath } from '@/lib/routing/articles';
import { Eye, FileText, Pencil, Rocket, Trash2, Undo2 } from 'lucide-react';
import {
  AdminLoadingState,
  IconActionButton,
  ListingFilterField,
  ListingFiltersCard,
  ListingFiltersGrid,
  ListingPagination,
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

interface Post {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'scheduled';
  publishedAt?: string;
  updatedAt: string;
  author?: {
    name: string;
  };
  categories?: Array<{ name: string; slug: string }>;
  tags?: Array<{ name: string; slug: string }>;
}

interface PostFilters {
  status: string;
  search: string;
  category: string;
  tag: string;
}

interface PostListingProps {
  initialPosts?: Post[];
  articleBasePath: string;
  articlePermalinkStyle: 'segment' | 'wordpress';
}

type ConfirmDialogState = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  confirmTone?: 'default' | 'destructive';
  onConfirm: () => Promise<void> | void;
};

export default function PostListing(props: PostListingProps) {
  return (
    <ToastProvider>
      <PostListingInner {...props} />
    </ToastProvider>
  );
}

function PostListingInner({ initialPosts = [], articleBasePath, articlePermalinkStyle }: PostListingProps) {
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<PostFilters>({
    status: '',
    search: '',
    category: '',
    tag: ''
  });
  const [searchField, setSearchField] = useState<'all' | 'title' | 'slug' | 'author'>('all');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: initialPosts.length
  });
  const [bulkAction, setBulkAction] = useState('');
  const [categories, setCategories] = useState<Array<{ name: string; slug: string }>>([]);
  const [tags, setTags] = useState<Array<{ name: string; slug: string }>>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const getPublicPostHref = (post: Post) => buildArticlePostPath(post.slug, post.publishedAt || post.updatedAt, {
    basePath: articleBasePath,
    permalinkStyle: articlePermalinkStyle
  });

  const openConfirm = useCallback((config: Omit<ConfirmDialogState, 'open'>) => {
    setConfirmBusy(false);
    setConfirmDialog({ ...config, open: true });
  }, []);

  // Load categories and tags for filters
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [categoriesRes, tagsRes] = await Promise.all([
          fetch('/api/admin/categories'),
          fetch('/api/admin/tags')
        ]);
        
        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        }
        
        if (tagsRes.ok) {
          const tagsData = await tagsRes.json();
          setTags(Array.isArray(tagsData) ? tagsData : []);
        }
      } catch (error) {
        console.error('Error loading filter options:', error);
        setCategories([]);
        setTags([]);
        toast({
          variant: 'destructive',
          title: 'Failed to load filters',
          description: 'Please refresh the page or try again.',
        });
      }
    };

    loadFilters();
  }, [toast]);

  // Load posts with filters
  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      if (filters.category) params.append('category', filters.category);
      if (filters.tag) params.append('tag', filters.tag);
      params.append('limit', pagination.limit.toString());
      params.append('offset', ((pagination.page - 1) * pagination.limit).toString());

      const response = await fetch(`/api/admin/posts?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || data);
        setPagination(prev => ({ ...prev, total: data.total || data.length }));
      } else {
        const error = await response.json().catch(() => null);
        toast({
          variant: 'destructive',
          title: 'Failed to load posts',
          description: error?.message || 'Please try again.',
        });
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load posts',
        description: 'Please refresh the page or try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit, toast]);

  // Load posts when filters change (but not on initial mount if we have initial posts)
  useEffect(() => {
    if (initialPosts.length === 0 || filters.status || filters.search || filters.category || filters.tag || pagination.page > 1) {
      loadPosts();
    }
  }, [loadPosts, initialPosts.length, filters.status, filters.search, filters.category, filters.tag, pagination.page]);

  // Handle filter changes
  const handleFilterChange = (key: keyof PostFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  // Handle post selection
  const handlePostSelection = (postId: string, selected: boolean) => {
    setSelectedPosts(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(postId);
      } else {
        newSet.delete(postId);
      }
      return newSet;
    });
  };

  // Handle select all
  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedPosts(new Set(posts.map(post => post.id)));
    } else {
      setSelectedPosts(new Set());
    }
  };

  const handleBulkAction = () => {
    if (!bulkAction || selectedPosts.size === 0) return;

    const actionCount = selectedPosts.size;
    const labels: Record<string, {
      verb: string;
      tone: 'default' | 'destructive';
      successTitle: string;
      successDescription: (count: number) => string;
      descriptionPrefix: string;
    }> = {
      publish: {
        verb: 'Publish',
        tone: 'default',
        successTitle: 'Posts published',
        successDescription: (count) => `${count} post${count === 1 ? '' : 's'} are now live.`,
        descriptionPrefix: 'publish',
      },
      draft: {
        verb: 'Move to draft',
        tone: 'default',
        successTitle: 'Posts moved to draft',
        successDescription: (count) => `${count} post${count === 1 ? '' : 's'} moved to draft.`,
        descriptionPrefix: 'move',
      },
      delete: {
        verb: 'Delete',
        tone: 'destructive',
        successTitle: 'Posts deleted',
        successDescription: (count) => `${count} post${count === 1 ? '' : 's'} removed.`,
        descriptionPrefix: 'delete',
      },
    };

    const meta = labels[bulkAction] ?? labels.publish;
    const pluralSuffix = actionCount === 1 ? '' : 's';
    const description = meta.descriptionPrefix === 'delete'
      ? `This will permanently delete ${actionCount} post${pluralSuffix}.`
      : `This will ${meta.descriptionPrefix} ${actionCount} post${pluralSuffix}.`;

    openConfirm({
      title: `${meta.verb} ${actionCount > 1 ? 'posts' : 'post'}`,
      description,
      confirmLabel: `${meta.verb}${actionCount > 1 ? ` ${actionCount} posts` : ''}`,
      confirmTone: meta.tone,
      onConfirm: async () => {
        try {
          setConfirmBusy(true);
          const response = await fetch('/api/admin/posts/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: bulkAction,
              postIds: Array.from(selectedPosts)
            })
          });

          if (response.ok) {
            setSelectedPosts(new Set());
            setBulkAction('');
            await loadPosts();
            toast({
              variant: 'success',
              title: meta.successTitle,
              description: meta.successDescription(actionCount),
            });
          } else {
            const error = await response.json().catch(() => null);
            toast({
              variant: 'destructive',
              title: 'Bulk action failed',
              description: error?.message || 'Please try again.',
            });
          }
        } catch (error) {
          console.error('Bulk action error:', error);
          toast({
            variant: 'destructive',
            title: 'Bulk action failed',
            description: 'Please try again.',
          });
        } finally {
          setConfirmBusy(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  const handlePostAction = useCallback((postId: string, action: string) => {
    const targetPost = posts.find(post => post.id === postId);
    const postTitle = targetPost?.title ?? 'this post';

    if (action === 'delete') {
      openConfirm({
        title: 'Delete post',
        description: `This will permanently delete "${postTitle}".`,
        confirmLabel: 'Delete post',
        confirmTone: 'destructive',
        onConfirm: async () => {
          try {
            setConfirmBusy(true);
            const response = await fetch(`/api/admin/posts/${postId}`, {
              method: 'DELETE'
            });

            if (response.ok) {
              await loadPosts();
              toast({
                variant: 'success',
                title: 'Post deleted',
                description: `"${postTitle}" has been removed.`,
              });
            } else {
              const error = await response.json().catch(() => null);
              toast({
                variant: 'destructive',
                title: 'Delete failed',
                description: error?.message || 'Please try again.',
              });
            }
          } catch (error) {
            console.error('Post action error:', error);
            toast({
              variant: 'destructive',
              title: 'Delete failed',
              description: 'Please try again.',
            });
          } finally {
            setConfirmBusy(false);
            setConfirmDialog(null);
          }
        },
      });
      return;
    }

    const successMessages: Record<string, { title: string; description: string }> = {
      publish: {
        title: 'Post published',
        description: `"${postTitle}" is now live.`,
      },
      unpublish: {
        title: 'Post unpublished',
        description: `"${postTitle}" is now a draft.`,
      },
    };

    (async () => {
      try {
        const response = await fetch(`/api/admin/posts/${postId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        });

        if (response.ok) {
          await loadPosts();
          if (successMessages[action]) {
            toast({
              variant: 'success',
              title: successMessages[action].title,
              description: successMessages[action].description,
            });
          }
        } else {
          const error = await response.json().catch(() => null);
          toast({
            variant: 'destructive',
            title: 'Action failed',
            description: error?.message || 'Please try again.',
          });
        }
      } catch (error) {
        console.error('Post action error:', error);
        toast({
          variant: 'destructive',
          title: 'Action failed',
          description: 'Please try again.',
        });
      }
    })();
  }, [posts, loadPosts, toast, openConfirm]);

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      // Keep server/client hydration output deterministic across runtime timezones.
      timeZone: 'UTC'
    }).format(new Date(date));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-success/10 text-success';
      case 'scheduled':
        return 'bg-info/10 text-info';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const filteredPosts = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    if (!needle) return posts;
    return posts.filter((post) => {
      const haystack = {
        title: post.title || '',
        slug: post.slug || '',
        author: post.author?.name || ''
      };
      if (searchField === 'all') {
        return `${haystack.title} ${haystack.slug} ${haystack.author}`.toLowerCase().includes(needle);
      }
      return haystack[searchField].toLowerCase().includes(needle);
    });
  }, [filters.search, posts, searchField]);

  return (
    <>
      <div className="space-y-6">
      {/* Filters */}
      <ListingFiltersCard>
        <ListingFiltersGrid columnsClassName="grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
          <ListingFilterField label="Status" htmlFor="status-filter">
            <select
              id="status-filter"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </ListingFilterField>

          <ListingFilterField label="Category" htmlFor="category-filter">
            <select
              id="category-filter"
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </ListingFilterField>

          <ListingFilterField label="Tag" htmlFor="tag-filter">
            <select
              id="tag-filter"
              value={filters.tag}
              onChange={(e) => handleFilterChange('tag', e.target.value)}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Tags</option>
              {tags.map(tag => (
                <option key={tag.slug} value={tag.slug}>
                  {tag.name}
                </option>
              ))}
            </select>
          </ListingFilterField>

          <ListingFilterField label="Search" htmlFor="search">
            <input
              id="search"
              type="text"
              placeholder="Search posts..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </ListingFilterField>
          <ListingFilterField label="Search In" htmlFor="search-field">
            <select
              id="search-field"
              value={searchField}
              onChange={(e) => setSearchField(e.target.value as 'all' | 'title' | 'slug' | 'author')}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All columns</option>
              <option value="title">Title</option>
              <option value="slug">Slug</option>
              <option value="author">Author</option>
            </select>
          </ListingFilterField>
        </ListingFiltersGrid>
      </ListingFiltersCard>

      {/* Bulk Actions */}
      {selectedPosts.size > 0 && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium">
              {selectedPosts.size} post(s) selected
            </span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary sm:w-auto"
              >
                <option value="">Choose action...</option>
                <option value="publish">Publish</option>
                <option value="draft">Move to Draft</option>
                <option value="delete">Delete</option>
              </select>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={handleBulkAction}
                  disabled={!bulkAction}
                  className="btn w-full sm:w-auto"
                >
                  Apply
                </button>
                <button
                  onClick={() => setSelectedPosts(new Set())}
                  className="btn btn-outline w-full sm:w-auto"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Posts Table */}
      <ListingTableCard>
        {loading && <AdminLoadingState label="Loading posts..." className="p-4" />}
        
        <ListingTableScroller>
          <table className="w-full min-w-full">
            <thead className="border-b border-border bg-muted/60">
              <tr>
                <th className="px-4 py-3 text-left sm:px-6">
                  <input
                    type="checkbox"
                    checked={posts.length > 0 && selectedPosts.size === posts.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-input"
                    aria-label="Select all posts"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:px-6">
                  Title
                </th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider md:table-cell">
                  Author
                </th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider lg:table-cell">
                  Categories
                </th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider md:table-cell">
                  Status
                </th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider xl:table-cell">
                  Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider sm:px-6">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-card">
              {filteredPosts.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center">
                      <FileText className="mb-4 h-12 w-12 text-muted-foreground/60" />
                      <p className="text-lg mb-2">No posts found</p>
                      <p className="text-sm text-muted-foreground mb-4">Try adjusting your filters or create a new post</p>
                      <a href="/admin/posts/new" className="btn">
                        Create New Post
                      </a>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-muted/60">
                    <td className="px-4 py-4 sm:px-6">
                      <input
                        type="checkbox"
                        checked={selectedPosts.has(post.id)}
                        onChange={(e) => handlePostSelection(post.id, e.target.checked)}
                        className="rounded border-input"
                        aria-label={`Select ${post.title}`}
                      />
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {post.title}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          /{post.slug}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:hidden">
                          <span>{post.author?.name || 'Unknown'}</span>
                          <span>•</span>
                          <span>{post.publishedAt ? formatDate(post.publishedAt) : formatDate(post.updatedAt)}</span>
                          <span className={`inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-full ${getStatusBadge(post.status)}`}>
                            {post.status}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 whitespace-nowrap md:table-cell">
                      <div className="text-sm text-foreground">{post.author?.name || 'Unknown'}</div>
                    </td>
                    <td className="hidden px-6 py-4 lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {post.categories?.map(category => (
                          <span key={category.slug} className="inline-flex px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
                            {category.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 whitespace-nowrap md:table-cell">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(post.status)}`}>
                        {post.status}
                      </span>
                    </td>
                    <td className="hidden px-6 py-4 whitespace-nowrap text-sm text-muted-foreground xl:table-cell">
                      {post.publishedAt ? formatDate(post.publishedAt) : formatDate(post.updatedAt)}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-medium sm:px-6">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {post.status === 'published' && (
                          <IconActionButton
                            title="View post"
                            ariaLabel={`View post: ${post.title}`}
                            href={getPublicPostHref(post)}
                            icon={<Eye className="h-3.5 w-3.5" />}
                            target="_blank"
                            rel="noreferrer"
                          />
                        )}
                        <IconActionButton
                          title="Edit post"
                          ariaLabel={`Edit post: ${post.title}`}
                          href={`/admin/posts/edit/${post.id}`}
                          icon={<Pencil className="h-3.5 w-3.5" />}
                        />
                        
                        {/* Status change buttons */}
                        {post.status === 'draft' && (
                          <IconActionButton
                            title="Publish post"
                            ariaLabel={`Publish post: ${post.title}`}
                            onClick={() => handlePostAction(post.id, 'publish')}
                            icon={<Rocket className="h-3.5 w-3.5" />}
                          />
                        )}
                        
                        {post.status === 'published' && (
                          <IconActionButton
                            title="Unpublish post"
                            ariaLabel={`Unpublish post: ${post.title}`}
                            onClick={() => handlePostAction(post.id, 'unpublish')}
                            icon={<Undo2 className="h-3.5 w-3.5" />}
                          />
                        )}
                        
                        <IconActionButton
                          title="Delete post"
                          ariaLabel={`Delete post: ${post.title}`}
                          onClick={() => handlePostAction(post.id, 'delete')}
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          destructive
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ListingTableScroller>
      </ListingTableCard>

      {/* Pagination */}
      {posts.length > 0 && (
        <ListingPagination
          page={pagination.page}
          limit={pagination.limit}
          total={pagination.total}
          loading={loading}
          itemLabel="results"
          onPrevious={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
          onNext={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
        />
      )}
      </div>

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
    </>
  );
}
