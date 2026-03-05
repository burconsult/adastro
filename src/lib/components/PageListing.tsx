import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ToastProvider, useToast } from '@/lib/components/ui/toast';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import {
  AdminLoadingState,
  IconActionButton,
  ListingFilterField,
  ListingFiltersCard,
  ListingFiltersGrid,
  ListingPagination,
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

interface PageRow {
  id: string;
  title: string;
  slug: string;
  locale?: string;
  status: 'draft' | 'published' | 'archived';
  updatedAt: string;
  publishedAt?: string;
  author?: {
    name: string;
  };
}

interface PageListingProps {
  initialPages?: PageRow[];
  defaultLocale?: string;
  supportedLocales?: string[];
}

type ConfirmDialogState = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  confirmTone?: 'default' | 'destructive';
  onConfirm: () => Promise<void> | void;
};

const statusStyles: Record<PageRow['status'], { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-muted text-muted-foreground'
  },
  published: {
    label: 'Published',
    className: 'bg-success/10 text-success'
  },
  archived: {
    label: 'Archived',
    className: 'bg-destructive/10 text-destructive'
  }
};

export default function PageListing(props: PageListingProps) {
  return (
    <ToastProvider>
      <PageListingInner {...props} />
    </ToastProvider>
  );
}

function PageListingInner({
  initialPages = [],
  defaultLocale = 'en',
  supportedLocales = ['en']
}: PageListingProps) {
  const { toast } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [pages, setPages] = useState<PageRow[]>(initialPages);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: '', locale: defaultLocale, search: '', searchField: 'all' });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: initialPages.length });
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const localeOptions = useMemo(() => {
    const deduped = Array.from(new Set(
      (supportedLocales || []).filter((locale) => typeof locale === 'string' && locale.trim().length > 0)
    ));
    return deduped.length > 0 ? deduped : [defaultLocale];
  }, [defaultLocale, supportedLocales]);

  const openConfirm = useCallback((config: Omit<ConfirmDialogState, 'open'>) => {
    setConfirmBusy(false);
    setConfirmDialog({ ...config, open: true });
  }, []);

  const closeConfirm = () => {
    setConfirmBusy(false);
    setConfirmDialog(null);
  };

  useEffect(() => {
    if (localeOptions.includes(filters.locale)) return;
    setFilters((prev) => ({ ...prev, locale: localeOptions[0] }));
  }, [filters.locale, localeOptions]);

  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.locale) params.append('locale', filters.locale);
      if (filters.search) params.append('search', filters.search);
      params.append('limit', pagination.limit.toString());
      params.append('offset', ((pagination.page - 1) * pagination.limit).toString());

      const response = await fetch(`/api/admin/pages?${params}`);
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || 'Failed to load pages');
      }
      const data = await response.json();
      setPages(data.pages || data);
      setPagination((prev) => ({ ...prev, total: data.total || data.length || 0 }));
    } catch (error) {
      console.error('Error loading pages:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load pages',
        description: error instanceof Error ? error.message : 'Please refresh and try again.'
      });
    } finally {
      setLoading(false);
    }
  }, [filters.locale, filters.search, filters.status, pagination.limit, pagination.page, toast]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (
      initialPages.length === 0
      || filters.status
      || filters.search
      || (filters.locale && filters.locale !== defaultLocale)
      || pagination.page > 1
    ) {
      loadPages();
    }
  }, [defaultLocale, filters.locale, filters.search, filters.status, pagination.page, initialPages.length, loadPages]);

  const handleFilterChange = (key: 'status' | 'locale' | 'search' | 'searchField', value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const filteredPages = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    if (!needle) return pages;

    const include = (page: PageRow) => {
      const fields = {
        title: page.title,
        slug: page.slug,
        author: page.author?.name || ''
      };
      if (filters.searchField === 'all') {
        return `${fields.title} ${fields.slug} ${fields.author}`.toLowerCase().includes(needle);
      }
      return String(fields[filters.searchField as keyof typeof fields] || '').toLowerCase().includes(needle);
    };

    return pages.filter(include);
  }, [filters.search, filters.searchField, pages]);

  const emptyMessage = useMemo(() => {
    if (loading) return 'Loading pages...';
    if (filters.status || filters.search) {
      const statusLabel = filters.status || 'all statuses';
      const fieldLabel = filters.searchField === 'all' ? 'all columns' : filters.searchField;
      if (filters.search) {
        return `No ${statusLabel} pages match "${filters.search}" in ${fieldLabel}.`;
      }
      return `No pages found for status: ${statusLabel}.`;
    }
    return 'No pages yet. Create your first page to get started.';
  }, [filters.search, filters.searchField, filters.status, loading]);

  const handleDelete = (page: PageRow) => {
    openConfirm({
      title: 'Delete page?',
      description: `This will permanently delete "${page.title}".`,
      confirmLabel: 'Delete page',
      confirmTone: 'destructive',
      onConfirm: async () => {
        try {
          setConfirmBusy(true);
          const response = await fetch(`/api/admin/pages/${page.id}`, { method: 'DELETE' });
          if (!response.ok) {
            const error = await response.json().catch(() => null);
            throw new Error(error?.message || 'Failed to delete page');
          }
          toast({
            variant: 'success',
            title: 'Page deleted',
            description: `${page.title} was removed.`
          });
          await loadPages();
          closeConfirm();
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Delete failed',
            description: error instanceof Error ? error.message : 'Please try again.'
          });
          setConfirmBusy(false);
        }
      }
    });
  };

  return (
    <div className="space-y-4">
      <ListingFiltersCard>
        <ListingFiltersGrid columnsClassName="grid-cols-1 md:grid-cols-[160px_140px_180px_1fr]">
          <ListingFilterField label="Status" htmlFor="page-status-filter">
            <select
              id="page-status-filter"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="mt-2 w-full rounded-md border border-input px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </ListingFilterField>
          <ListingFilterField label="Locale" htmlFor="page-locale-filter">
            <select
              id="page-locale-filter"
              value={filters.locale}
              onChange={(e) => handleFilterChange('locale', e.target.value)}
              className="mt-2 w-full rounded-md border border-input px-3 py-2 text-sm"
            >
              {localeOptions.map((locale) => (
                <option key={locale} value={locale}>
                  {locale}
                </option>
              ))}
            </select>
          </ListingFilterField>
          <ListingFilterField label="Search In" htmlFor="page-search-field-filter">
            <select
              id="page-search-field-filter"
              value={filters.searchField}
              onChange={(e) => handleFilterChange('searchField', e.target.value)}
              className="mt-2 w-full rounded-md border border-input px-3 py-2 text-sm"
            >
              <option value="all">All columns</option>
              <option value="title">Title</option>
              <option value="slug">Slug</option>
              <option value="author">Author</option>
            </select>
          </ListingFilterField>
          <ListingFilterField label="Search" htmlFor="page-search-filter">
            <input
              id="page-search-filter"
              type="search"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search title or slug"
              className="mt-2 w-full rounded-md border border-input px-3 py-2 text-sm"
            />
          </ListingFilterField>
        </ListingFiltersGrid>
      </ListingFiltersCard>

      <ListingTableCard>
        <ListingTableScroller>
          <table className="w-full min-w-full text-sm">
            <thead className="border-b border-border bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Slug</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="hidden px-4 py-3 text-left lg:table-cell">Updated</th>
                <th className="px-4 py-3 text-right sm:px-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-card">
              {filteredPages.map((page) => {
                const status = statusStyles[page.status];
                const locale = page.locale || defaultLocale;
                const viewHref = page.slug === 'home' ? `/${locale}` : `/${locale}/${page.slug}`;
                return (
                  <tr key={page.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{page.title}</div>
                      <div className="text-xs text-muted-foreground md:hidden">/{page.locale || defaultLocale}/{page.slug}</div>
                      {page.author?.name && (
                        <div className="text-xs text-muted-foreground">by {page.author.name}</div>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">/{page.locale || defaultLocale}/{page.slug}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {hydrated ? new Date(page.updatedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-6">
                      <div className="inline-flex items-center gap-2 text-sm">
                        <IconActionButton title="View page" href={viewHref} icon={<Eye className="h-3.5 w-3.5" />} />
                        <IconActionButton title="Edit page" href={`/admin/pages/edit/${page.id}`} icon={<Pencil className="h-3.5 w-3.5" />} />
                        <IconActionButton title="Delete page" onClick={() => handleDelete(page)} icon={<Trash2 className="h-3.5 w-3.5" />} destructive />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredPages.length === 0 && !loading && (
                <ListingStateRow colSpan={5} text={emptyMessage} />
              )}
              {loading && (
                <tr>
                  <td colSpan={5}>
                    <AdminLoadingState label="Loading pages..." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ListingTableScroller>
      </ListingTableCard>

      <ListingPagination
        page={pagination.page}
        limit={pagination.limit}
        total={pagination.total}
        loading={loading}
        itemLabel="pages"
        onPrevious={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
        onNext={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
      />

      <Dialog open={Boolean(confirmDialog?.open)} onOpenChange={(open) => (!open ? closeConfirm() : null)}>
        {confirmDialog && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmDialog.title}</DialogTitle>
              {confirmDialog.description && (
                <DialogDescription>{confirmDialog.description}</DialogDescription>
              )}
            </DialogHeader>
            <DialogFooter>
              <button type="button" className="btn btn-outline" onClick={closeConfirm} disabled={confirmBusy}>
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${confirmDialog.confirmTone === 'destructive' ? 'btn-destructive' : ''}`}
                onClick={confirmDialog.onConfirm}
                disabled={confirmBusy}
              >
                {confirmBusy ? 'Working...' : confirmDialog.confirmLabel}
              </button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
