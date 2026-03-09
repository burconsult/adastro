import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import PostListing from '../PostListing';

// Mock fetch
global.fetch = vi.fn();

const mockPosts = [
  {
    id: '1',
    title: 'Test Post 1',
    slug: 'test-post-1',
    status: 'published' as const,
    publishedAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    author: { name: 'John Doe' },
    categories: [{ name: 'Tech', slug: 'tech' }],
    tags: [{ name: 'JavaScript', slug: 'javascript' }]
  },
  {
    id: '2',
    title: 'Test Post 2',
    slug: 'test-post-2',
    status: 'draft' as const,
    publishedAt: undefined,
    updatedAt: '2024-01-02T00:00:00Z',
    author: { name: 'Jane Smith' },
    categories: [],
    tags: []
  }
];

const mockCategories = [
  { name: 'Tech', slug: 'tech' },
  { name: 'Design', slug: 'design' }
];

const mockTags = [
  { name: 'JavaScript', slug: 'javascript' },
  { name: 'React', slug: 'react' }
];

type PostListingProps = React.ComponentProps<typeof PostListing>;

async function renderPostListing(props?: Partial<PostListingProps>) {
  const baseProps: PostListingProps = {
    initialPosts: mockPosts,
    articleBasePath: 'articles',
    articlePermalinkStyle: 'segment'
  };
  let utils: ReturnType<typeof render> | undefined;
  await act(async () => {
    utils = render(<PostListing {...baseProps} {...props} />);
  });
  return utils!;
}

describe('PostListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/admin/categories')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCategories)
        });
      }
      if (url.includes('/api/admin/tags')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTags)
        });
      }
      if (url.includes('/api/admin/posts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ posts: mockPosts, total: mockPosts.length })
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('renders post listing with initial posts', async () => {
    await renderPostListing();
    
    expect(screen.getByText('Test Post 1')).toBeInTheDocument();
    expect(screen.getByText('Test Post 2')).toBeInTheDocument();
    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Jane Smith').length).toBeGreaterThan(0);
  });

  it('displays status badges correctly', async () => {
    await renderPostListing();
    
    expect(screen.getAllByText('published').length).toBeGreaterThan(0);
    expect(screen.getAllByText('draft').length).toBeGreaterThan(0);
  });

  it('shows empty state when no posts', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/admin/categories')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      }
      if (url.includes('/api/admin/tags')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      }
      if (url.includes('/api/admin/posts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ posts: [], total: 0 })
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    await renderPostListing({ initialPosts: [] });
    
    await waitFor(() => {
      expect(screen.getByText('No posts found')).toBeInTheDocument();
    });
    expect(screen.getByText('Try adjusting your filters or create a new post')).toBeInTheDocument();
  });

  it('handles post selection', async () => {
    await renderPostListing();
    
    const checkboxes = screen.getAllByRole('checkbox');
    const firstPostCheckbox = checkboxes[1]; // Skip the "select all" checkbox
    
    fireEvent.click(firstPostCheckbox);
    
    expect(screen.getByText('1 post(s) selected')).toBeInTheDocument();
  });

  it('handles select all functionality', async () => {
    await renderPostListing();
    
    const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
    
    fireEvent.click(selectAllCheckbox);
    
    expect(screen.getByText('2 post(s) selected')).toBeInTheDocument();
  });

  it('shows bulk actions when posts are selected', async () => {
    await renderPostListing();
    
    const firstPostCheckbox = screen.getAllByRole('checkbox')[1];
    fireEvent.click(firstPostCheckbox);
    
    expect(screen.getByText('Choose action...')).toBeInTheDocument();
    expect(screen.getByText('Apply')).toBeInTheDocument();
    expect(screen.getByText('Clear Selection')).toBeInTheDocument();
  });

  it('filters posts by status', async () => {
    await renderPostListing();
    
    const statusFilter = screen.getByLabelText('Status');
    fireEvent.change(statusFilter, { target: { value: 'published' } });
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=published')
      );
    });
  });

  it('defaults locale filter to all locales', async () => {
    await renderPostListing({ supportedLocales: ['en', 'nb'] });

    const localeFilter = screen.getByLabelText('Locale') as HTMLSelectElement;
    expect(localeFilter.value).toBe('');
    expect(screen.getByRole('option', { name: 'All locales' })).toBeInTheDocument();
  });

  it('filters posts by locale', async () => {
    await renderPostListing({ supportedLocales: ['en', 'nb'] });

    const localeFilter = screen.getByLabelText('Locale');
    fireEvent.change(localeFilter, { target: { value: 'nb' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('locale=nb')
      );
    });
  });

  it('searches posts by title', async () => {
    await renderPostListing();
    
    const searchInput = screen.getByLabelText('Search');
    fireEvent.change(searchInput, { target: { value: 'Test Post 1' } });
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=Test+Post+1')
      );
    });
  });

  it('handles bulk publish action', async () => {
    (global.fetch as any).mockImplementation((url: string, options: any) => {
      if (url.includes('/api/admin/posts/bulk') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, message: 'Bulk action completed' })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ posts: mockPosts, total: mockPosts.length })
      });
    });

    await renderPostListing();
    
    // Select a post
    const firstPostCheckbox = screen.getAllByRole('checkbox')[1];
    fireEvent.click(firstPostCheckbox);
    
    // Select bulk action
    const actionSelect = screen.getByDisplayValue('Choose action...');
    fireEvent.change(actionSelect, { target: { value: 'publish' } });
    
    // Apply action
    const applyButton = screen.getByText('Apply');
    fireEvent.click(applyButton);

    const confirmDialog = await screen.findByRole('dialog');
    const confirmButton = within(confirmDialog).getByRole('button', { name: 'Publish' });
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/posts/bulk',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'publish',
            postIds: ['1']
          })
        })
      );
    });
  });

  it('handles individual post publish action', async () => {
    (global.fetch as any).mockImplementation((url: string, options: any) => {
      if (url.includes('/api/admin/posts/2') && options?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ posts: mockPosts, total: mockPosts.length })
      });
    });

    await renderPostListing();
    
    // Find and click the publish button for the draft post
    const publishButtons = screen.getAllByTitle('Publish post');
    fireEvent.click(publishButtons[0]);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/posts/2',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'publish' })
        })
      );
    });
  });

  it('handles individual post delete action', async () => {
    (global.fetch as any).mockImplementation((url: string, options: any) => {
      if (url.includes('/api/admin/posts/1') && options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ posts: mockPosts, total: mockPosts.length })
      });
    });

    await renderPostListing();
    
    // Find and click the delete button
    const deleteButtons = screen.getAllByTitle('Delete post');
    fireEvent.click(deleteButtons[0]);

    const confirmButton = await screen.findByRole('button', { name: 'Delete post' });
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/posts/1',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  it('displays loading state', async () => {
    (global.fetch as any).mockImplementation(() => new Promise(() => {}));
    await renderPostListing({ initialPosts: [] });
    
    expect(screen.getByText('Loading posts...')).toBeInTheDocument();
  });

  it('handles pagination', async () => {
    await renderPostListing();
    
    // Wait for the component to finish loading
    await waitFor(() => {
      expect(screen.queryByText('Loading posts...')).not.toBeInTheDocument();
    });
    
    // Check pagination controls exist
    expect(screen.getByText('Previous')).toBeDisabled();
    expect(screen.getByText('Next')).toBeDisabled();
    
    // Check that results count is shown
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(screen.getByText(/results/)).toBeInTheDocument();
  });
});
