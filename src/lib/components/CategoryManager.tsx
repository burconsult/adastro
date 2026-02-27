import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ToastProvider, useToast } from '@/lib/components/ui/toast';
import { FolderOpen, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
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

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  postCount?: number;
}

interface CategoryManagerProps {
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

export default function CategoryManager(props: CategoryManagerProps) {
  return (
    <ToastProvider>
      <CategoryManagerInner {...props} />
    </ToastProvider>
  );
}

function CategoryManagerInner({ onClose }: CategoryManagerProps) {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    parentId: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/categories');
      if (!response.ok) {
        throw new Error('Failed to load categories');
      }
      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load categories',
        description: 'Please refresh the page or try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const categoryNameById = useMemo(() => {
    const entries = categories.map((category) => [category.id, category.name]);
    return new Map<string, string>(entries);
  }, [categories]);

  const filteredCategories = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return categories;

    return categories.filter((category) => {
      const parentName = category.parentId ? categoryNameById.get(category.parentId) : '';
      return [category.name, category.slug, category.description || '', parentName || '']
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [categories, categoryNameById, searchTerm]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const payload = {
      ...formData,
      name: formData.name.trim(),
      slug: (formData.slug || generateSlug(formData.name)).trim(),
      description: formData.description.trim(),
      parentId: formData.parentId || null,
    };

    if (!payload.name || !payload.slug) {
      toast({
        variant: 'destructive',
        title: 'Missing information',
        description: 'Name and slug are required.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const url = editingCategory
        ? `/api/admin/categories/${editingCategory.id}`
        : '/api/admin/categories';

      const method = editingCategory ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setShowForm(false);
        setEditingCategory(null);
        setFormData({ name: '', slug: '', description: '', parentId: '' });
        await loadCategories();
        toast({
          variant: 'success',
          title: editingCategory ? 'Category updated' : 'Category created',
          description: editingCategory
            ? `"${payload.name}" has been updated.`
            : `"${payload.name}" is now available in your categories list.`,
        });
      } else {
        const error = await response.json().catch(() => null);
        toast({
          variant: 'destructive',
          title: 'Could not save category',
          description: error?.message || 'Please try again.',
        });
      }
    } catch (error) {
      console.error('Error saving category:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to save category',
        description: 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      parentId: category.parentId || ''
    });
    setShowForm(true);
  };

  const handleDelete = (category: Category) => {
    if (category.postCount && category.postCount > 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot delete category',
        description: `"${category.name}" is used by ${category.postCount} post${category.postCount === 1 ? '' : 's'}.`,
      });
      return;
    }

    openConfirm({
      title: 'Delete category',
      description: `This will permanently remove "${category.name}".`,
      confirmLabel: 'Delete category',
      confirmTone: 'destructive',
      onConfirm: async () => {
        try {
          setConfirmBusy(true);
          const response = await fetch(`/api/admin/categories/${category.id}`, {
            method: 'DELETE'
          });

          if (response.ok) {
            await loadCategories();
            toast({
              variant: 'success',
              title: 'Category deleted',
              description: `"${category.name}" has been removed.`,
            });
          } else {
            const error = await response.json().catch(() => null);
            toast({
              variant: 'destructive',
              title: 'Could not delete category',
              description: error?.message || 'Please try again.',
            });
          }
        } catch (error) {
          console.error('Error deleting category:', error);
          toast({
            variant: 'destructive',
            title: 'Failed to delete category',
            description: 'Please try again.',
          });
        } finally {
          setConfirmBusy(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingCategory(null);
    setFormData({ name: '', slug: '', description: '', parentId: '' });
  };

  const openConfirm = (config: Omit<ConfirmDialogState, 'open'>) => {
    setConfirmBusy(false);
    setConfirmDialog({ ...config, open: true });
  };

  if (loading) {
    return (
      <AdminLoadingState label="Loading categories..." />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {filteredCategories.length} categor{filteredCategories.length === 1 ? 'y' : 'ies'}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setEditingCategory(null);
              setFormData({ name: '', slug: '', description: '', parentId: '' });
              setShowForm(true);
            }}
            className="btn btn-primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Category
          </button>
          <button onClick={loadCategories} className="btn btn-outline" type="button">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
          {onClose && (
            <button onClick={onClose} className="btn btn-outline">
              Close
            </button>
          )}
        </div>
      </div>

      <ListingFiltersCard>
        <ListingFiltersGrid columnsClassName="grid-cols-1 md:grid-cols-[1fr_auto]">
          <ListingFilterField label="Search" htmlFor="category-search">
            <input
              id="category-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search categories"
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
            />
          </ListingFilterField>
          <div className="flex items-end text-sm text-muted-foreground">
            {categories.length} total categor{categories.length === 1 ? 'y' : 'ies'}
          </div>
        </ListingFiltersGrid>
      </ListingFiltersCard>

      {showForm && (
        <div className="card p-6">
          <h3 className="mb-4 text-lg font-semibold">
            {editingCategory ? 'Edit Category' : 'New Category'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-1 block text-sm font-medium">
                  Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setFormData(prev => ({
                      ...prev,
                      name,
                      slug: prev.slug || generateSlug(name)
                    }));
                  }}
                  className="w-full rounded-md border border-input px-3 py-2"
                  required
                />
              </div>
              <div>
                <label htmlFor="slug" className="mb-1 block text-sm font-medium">
                  Slug *
                </label>
                <input
                  id="slug"
                  type="text"
                  value={formData.slug}
                  onChange={(event) => setFormData(prev => ({ ...prev, slug: event.target.value }))}
                  className="w-full rounded-md border border-input px-3 py-2"
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="description" className="mb-1 block text-sm font-medium">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(event) => setFormData(prev => ({ ...prev, description: event.target.value }))}
                className="h-24 w-full rounded-md border border-input px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="parent" className="mb-1 block text-sm font-medium">
                Parent Category
              </label>
              <select
                id="parent"
                value={formData.parentId}
                onChange={(event) => setFormData(prev => ({ ...prev, parentId: event.target.value }))}
                className="w-full rounded-md border border-input px-3 py-2"
              >
                <option value="">No parent</option>
                {categories
                  .filter(category => !editingCategory || category.id !== editingCategory.id)
                  .map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting} aria-disabled={isSubmitting}>
                {editingCategory ? 'Update Category' : 'Create Category'}
              </button>
              <button type="button" onClick={handleCancel} className="btn btn-outline">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {categories.length === 0 && !searchTerm ? (
        <div className="card p-12 text-center text-muted-foreground">
          <div className="flex flex-col items-center">
            <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/60" />
            <p className="mb-2 text-lg">No categories yet</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Create your first category to organize your content.
            </p>
            <button
              onClick={() => {
                setEditingCategory(null);
                setFormData({ name: '', slug: '', description: '', parentId: '' });
                setShowForm(true);
              }}
              className="btn btn-primary"
              type="button"
            >
              Create Category
            </button>
          </div>
        </div>
      ) : (
        <ListingTableCard>
          <ListingTableScroller>
            <table className="w-full min-w-full text-sm">
              <thead className="border-b border-border bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="hidden px-4 py-3 text-left md:table-cell">Slug</th>
                  <th className="hidden px-4 py-3 text-left lg:table-cell">Parent</th>
                  <th className="px-4 py-3 text-left">Posts</th>
                  <th className="px-4 py-3 text-right sm:px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-card">
                {filteredCategories.map((category) => {
                  const postCount = category.postCount || 0;
                  const parentName = category.parentId ? categoryNameById.get(category.parentId) : null;

                  return (
                    <tr key={category.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{category.name}</div>
                        {category.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{category.description}</p>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">/{category.slug}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                        {parentName ? `↳ ${parentName}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                          {postCount} post{postCount === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right sm:px-6">
                        <div className="inline-flex items-center gap-2">
                          <IconActionButton
                            title="Edit Category"
                            onClick={() => handleEdit(category)}
                            icon={<Pencil className="h-3.5 w-3.5" />}
                          />
                          <IconActionButton
                            title="Delete Category"
                            ariaLabel={`Open delete dialog for category ${category.name}`}
                            onClick={() => handleDelete(category)}
                            icon={<Trash2 className="h-3.5 w-3.5" />}
                            destructive
                            disabled={confirmBusy}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredCategories.length === 0 && (
                  <ListingStateRow colSpan={5} text="No categories match your search." />
                )}
              </tbody>
            </table>
          </ListingTableScroller>
        </ListingTableCard>
      )}

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
