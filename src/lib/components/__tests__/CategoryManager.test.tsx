import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CategoryManager from '../CategoryManager';

type FetchMock = typeof global.fetch & vi.Mock;

declare global {
  // eslint-disable-next-line no-var
  var fetch: FetchMock;
}

const mockCategories = [
  {
    id: '1',
    name: 'Technology',
    slug: 'technology',
    description: 'Tech related posts',
    parentId: null,
    postCount: 5
  },
  {
    id: '2',
    name: 'JavaScript',
    slug: 'javascript',
    description: 'JavaScript tutorials',
    parentId: '1',
    postCount: 3
  },
  {
    id: '3',
    name: 'Design',
    slug: 'design',
    description: 'Design articles',
    parentId: null,
    postCount: 0
  }
];

const createApiResponse = (data: unknown, ok = true) => ({
  ok,
  json: () => Promise.resolve(data)
});

const fetchMock = vi.fn() as FetchMock;

global.fetch = fetchMock;

const setupDefaultFetchMock = () => {
  fetchMock.mockImplementation((url: string, options?: RequestInit) => {
    if (url.includes('/api/admin/locales')) {
      return Promise.resolve(createApiResponse({ activeLocales: ['en', 'nb', 'es'] }));
    }

    if (url.includes('/api/admin/categories')) {
      if (!options?.method) {
        return Promise.resolve(createApiResponse(mockCategories));
      }

      if (options.method === 'POST') {
        return Promise.resolve(createApiResponse({
          id: '4',
          name: 'New Category',
          slug: 'new-category',
          description: '',
          parentId: null
        }));
      }

      if (options.method === 'DELETE') {
        return Promise.resolve(createApiResponse({ success: true }));
      }

      if (options.method === 'PUT') {
        return Promise.resolve(createApiResponse({ success: true }));
      }
    }

    return Promise.reject(new Error(`Unhandled fetch call: ${url}`));
  });
};

const renderCategoryManager = async (props: Parameters<typeof CategoryManager>[0] = {}) => {
  render(<CategoryManager {...props} />);
  await screen.findByRole('button', { name: /New Category/i });
};

describe('CategoryManager', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    setupDefaultFetchMock();
  });

  it('renders category list', async () => {
    await renderCategoryManager();

    expect(screen.getByText('Technology')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('Design')).toBeInTheDocument();
  });

  it('shows category post counts', async () => {
    await renderCategoryManager();

    expect(screen.getByText(/5\s+posts/i)).toBeInTheDocument();
    expect(screen.getByText(/3\s+posts/i)).toBeInTheDocument();
    expect(screen.getByText(/0\s+posts/i)).toBeInTheDocument();
  });

  it('opens new category form', async () => {
    await renderCategoryManager();

    const newCategoryButton = screen.getByRole('button', { name: /New Category/i });
    fireEvent.click(newCategoryButton);

    expect(screen.getByRole('heading', { name: 'New Category' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Slug *')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('auto-generates slug from name', async () => {
    await renderCategoryManager();

    fireEvent.click(screen.getByRole('button', { name: /New Category/i }));

    const nameInput = screen.getByLabelText('Name *');
    const slugInput = screen.getByLabelText('Slug *');

    fireEvent.change(nameInput, { target: { value: 'Web Development' } });

    expect(slugInput).toHaveValue('web-development');
  });

  it('creates new category', async () => {
    await renderCategoryManager();

    fireEvent.click(screen.getByRole('button', { name: /New Category/i }));

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'New Category' } });
    fireEvent.change(screen.getByLabelText('Slug *'), { target: { value: 'new-category' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A new category' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Category/i }));

    await waitFor(() => {
      const createCall = fetchMock.mock.calls.find(([url, options]) => (
        url === '/api/admin/categories' && options?.method === 'POST'
      ));
      expect(createCall).toBeTruthy();
      const payload = JSON.parse(String(createCall?.[1]?.body || '{}'));
      expect(payload).toMatchObject({
        name: 'New Category',
        slug: 'new-category',
        description: 'A new category',
        parentId: null,
        localizations: {
          labels: {},
          descriptions: {}
        }
      });
    });
  });

  it('edits existing category', async () => {
    await renderCategoryManager();

    const editButtons = await screen.findAllByTitle('Edit Category');
    fireEvent.click(editButtons[0]);

    expect(screen.getByRole('heading', { name: 'Edit Category' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Technology')).toBeInTheDocument();
    expect(screen.getByDisplayValue('technology')).toBeInTheDocument();
  });

  it('deletes category with no posts', async () => {
    await renderCategoryManager();

    const deleteButtons = await screen.findAllByTitle('Delete Category');
    fireEvent.click(deleteButtons[2]);

    const confirmButton = await screen.findByRole('button', { name: /Delete category/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/categories/3',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  it('prevents deletion of category with posts', async () => {
    await renderCategoryManager();

    const deleteButtons = await screen.findAllByTitle('Delete Category');
    fireEvent.click(deleteButtons[0]);

    await screen.findByText(/Cannot delete category/i);

    const deleteCall = fetchMock.mock.calls.find(([url, options]) =>
      url === '/api/admin/categories/1' && options?.method === 'DELETE'
    );

    expect(deleteCall).toBeUndefined();
  });

  it('shows empty state when no categories', async () => {
    const defaultImplementation = fetchMock.getMockImplementation();

    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/admin/categories') && !options?.method) {
        return Promise.resolve(createApiResponse([]));
      }

      if (defaultImplementation) {
        return defaultImplementation(url, options);
      }

      return Promise.reject(new Error(`Unhandled fetch call: ${url}`));
    });

    await renderCategoryManager();

    expect(screen.getByText('No categories yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first category to organize your content.')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));

    render(<CategoryManager />);

    expect(screen.getByText('Loading categories...')).toBeInTheDocument();
  });

  it('handles parent category selection', async () => {
    await renderCategoryManager();

    fireEvent.click(screen.getByRole('button', { name: /New Category/i }));

    const parentSelect = screen.getByLabelText('Parent Category');
    expect(parentSelect).toBeInTheDocument();
    expect(screen.getByText('No parent')).toBeInTheDocument();

    fireEvent.change(parentSelect, { target: { value: '1' } });
    expect(parentSelect).toHaveValue('1');
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    await renderCategoryManager({ onClose });

    const closeButton = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('cancels form editing', async () => {
    await renderCategoryManager();

    fireEvent.click(screen.getByRole('button', { name: /New Category/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('heading', { name: 'New Category' })).not.toBeInTheDocument();
  });
});
