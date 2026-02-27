import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TagManager from '../TagManager';

// Mock fetch
global.fetch = vi.fn();

const mockTags = [
  {
    id: '1',
    name: 'JavaScript',
    slug: 'javascript',
    postCount: 5
  },
  {
    id: '2',
    name: 'React',
    slug: 'react',
    postCount: 3
  },
  {
    id: '3',
    name: 'Unused Tag',
    slug: 'unused-tag',
    postCount: 0
  }
];

const mockStats = {
  totalTags: 3,
  usedTags: 2,
  unusedTags: 1,
  averagePostsPerTag: 4.0,
  mostUsedTag: {
    id: '1',
    name: 'JavaScript',
    slug: 'javascript',
    postCount: 5
  }
};

describe('TagManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API responses
    (global.fetch as any).mockImplementation((url: string, options: any) => {
      if (url.includes('/api/admin/tags/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStats)
        });
      }
      if (url.includes('/api/admin/tags/merge') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            mergedPosts: 2,
            deletedTags: ['2'],
            errors: []
          })
        });
      }
      if (url.includes('/api/admin/tags/') && options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      }
      if (url.includes('/api/admin/tags') && !options?.method) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTags)
        });
      }
      if (url.includes('/api/admin/tags') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: '4',
            name: 'New Tag',
            slug: 'new-tag'
          })
        });
      }
      if (url.includes('/api/admin/tags/bulk') && options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  type TagManagerProps = React.ComponentProps<typeof TagManager>;

  async function renderTagManager(props?: Partial<TagManagerProps>) {
    let utils: ReturnType<typeof render> | undefined;
    await act(async () => {
      utils = render(<TagManager {...props} />);
    });
    return utils!;
  }

  it('renders tag list in grid format', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      expect(screen.getByText('JavaScript')).toBeInTheDocument();
      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByText('Unused Tag')).toBeInTheDocument();
    });
  });

  it('shows post counts for each tag', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      expect(screen.getByText('5 posts')).toBeInTheDocument();
      expect(screen.getByText('3 posts')).toBeInTheDocument();
      expect(screen.getByText('0 posts')).toBeInTheDocument();
    });
  });

  it('shows cleanup button in header', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      expect(screen.getByText('Cleanup')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  it('opens new tag form', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      const newTagButton = screen.getByText('New Tag');
      fireEvent.click(newTagButton);
    });
    
    expect(screen.getByText('New Tag')).toBeInTheDocument();
    expect(screen.getByLabelText('Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Slug *')).toBeInTheDocument();
  });

  it('auto-generates slug from name', async () => {
    await renderTagManager();
    
    const newTagButton = screen.getByText('New Tag');
    fireEvent.click(newTagButton);
    
    const nameInput = screen.getByLabelText('Name *');
    const slugInput = screen.getByLabelText('Slug *');
    
    fireEvent.change(nameInput, { target: { value: 'Vue.js Framework' } });
    
    expect(slugInput).toHaveValue('vue-js-framework');
  });

  it('creates new tag', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      const newTagButton = screen.getByText('New Tag');
      fireEvent.click(newTagButton);
    });
    
    const nameInput = screen.getByLabelText('Name *');
    const slugInput = screen.getByLabelText('Slug *');
    
    fireEvent.change(nameInput, { target: { value: 'New Tag' } });
    fireEvent.change(slugInput, { target: { value: 'new-tag' } });
    
    const createButton = screen.getByText('Create Tag');
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/tags',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'New Tag',
            slug: 'new-tag'
          })
        })
      );
    });
  });

  it('edits existing tag', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      const editButtons = screen.getAllByTitle('Edit Tag');
      fireEvent.click(editButtons[0]);
    });
    
    expect(screen.getByText('Edit Tag')).toBeInTheDocument();
    expect(screen.getByDisplayValue('JavaScript')).toBeInTheDocument();
    expect(screen.getByDisplayValue('javascript')).toBeInTheDocument();
  });

  it('deletes individual tag with no posts', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      const deleteButtons = screen.getAllByTitle('Delete Tag');
      // Click delete for Unused Tag (which has 0 posts)
      fireEvent.click(deleteButtons[2]);
    });

    const confirmButton = await screen.findByRole('button', { name: 'Delete tag' });
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/tags/3',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  it('prevents deletion of tag with posts', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      const deleteButtons = screen.getAllByTitle('Delete Tag');
      // Click delete for JavaScript tag (which has 5 posts)
      fireEvent.click(deleteButtons[0]);
    });

    const deletionCall = (global.fetch as any).mock.calls.find(([url, options]: [string, any]) =>
      url.includes('/api/admin/tags/1') && options?.method === 'DELETE'
    );
    expect(deletionCall).toBeUndefined();

    expect(await screen.findByText('Cannot delete tag')).toBeInTheDocument();
  });

  it('opens cleanup dialog and performs cleanup', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      const cleanupButton = screen.getByText('Cleanup');
      fireEvent.click(cleanupButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Tag Cleanup')).toBeInTheDocument();
      const deleteUnusedButton = screen.getByText('Delete Unused Tags');
      fireEvent.click(deleteUnusedButton);
    });

    const confirmButton = await screen.findByRole('button', { name: 'Delete unused tag' });
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/tags/bulk',
        expect.objectContaining({
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tagIds: ['3'] // Only the unused tag
          })
        })
      );
    });
  });

  it('searches tags', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Search tags...');
      fireEvent.change(searchInput, { target: { value: 'React' } });
    });
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=React')
      );
    });
  });

  it('shows tag count in search area', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      expect(screen.getByText('3 tags')).toBeInTheDocument();
    });
  });

  it('shows empty state when no tags', async () => {
    (global.fetch as any).mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      });
    });
    
    await renderTagManager();
    
    await waitFor(() => {
      expect(screen.getByText('No tags found')).toBeInTheDocument();
      expect(screen.getByText('Create your first tag to label your content')).toBeInTheDocument();
    });
  });

  it('shows empty state for search with no results', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/admin/tags/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStats)
        });
      }
      if (url.includes('search=nonexistent')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTags)
      });
    });
    
    await renderTagManager();
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Search tags...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    });
    
    await waitFor(() => {
      expect(screen.getByText('No tags found')).toBeInTheDocument();
      expect(screen.getByText('Try a different search term')).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    // Mock a delayed response
    (global.fetch as any).mockImplementation(() => {
      return new Promise(() => {}); // Never resolves
    });
    
    await renderTagManager();
    
    expect(screen.getByText('Loading tags...')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    await renderTagManager({ onClose });
    
    await waitFor(() => {
      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);
    });
    
    expect(onClose).toHaveBeenCalled();
  });

  it('cancels form editing', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      const newTagButton = screen.getByText('New Tag');
      fireEvent.click(newTagButton);
    });
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(screen.queryByText('New Tag')).not.toBeInTheDocument();
  });

  it('shows cleanup dialog even with no unused tags', async () => {
    const tagsWithPosts = mockTags.map(tag => ({ ...tag, postCount: tag.postCount || 1 }));
    
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/admin/tags/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...mockStats, unusedTags: 0 })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(tagsWithPosts)
      });
    });
    
    await renderTagManager();
    
    await waitFor(() => {
      const cleanupButton = screen.getByText('Cleanup');
      fireEvent.click(cleanupButton);
      expect(screen.getByText('Tag Cleanup')).toBeInTheDocument();
    });
  });

  it('displays tag statistics', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument(); // Total tags
      expect(screen.getByText('Total Tags')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Used tags
      expect(screen.getByText('Used Tags')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // Unused tags
      expect(screen.getByText('Unused Tags')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument(); // Average posts per tag
      expect(screen.getByText('Avg Posts/Tag')).toBeInTheDocument();
    });
  });

  it('shows selection checkboxes for tags', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });
  });

  it('shows bulk actions when tags are selected', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // Select first tag
    });
    
    await waitFor(() => {
      expect(screen.getByText(/selected/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete Selected/i })).toBeInTheDocument();
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });
  });

  it('shows merge button when multiple tags are selected', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // Select first tag
      fireEvent.click(checkboxes[1]); // Select second tag
    });
    
    await waitFor(() => {
      expect(screen.getByText('Merge')).toBeInTheDocument();
    });
  });

  it('selects all visible tags', async () => {
    await renderTagManager();
    
    // First select one tag to show bulk actions
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
    });

    await waitFor(() => {
      const selectAllButton = screen.getByText('Select All');
      fireEvent.click(selectAllButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/3.*selected/)).toBeInTheDocument();
    });
  });

  it('clears tag selection', async () => {
    await renderTagManager();
    
    // First select a tag
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
    });

    await waitFor(() => {
      const clearButton = screen.getByText('Clear');
      fireEvent.click(clearButton);
    });
    
    // Bulk actions should be hidden
    await waitFor(() => {
      expect(screen.queryByText('Clear')).not.toBeInTheDocument();
    });
  });

  it('opens merge dialog', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // Select first tag
      fireEvent.click(checkboxes[1]); // Select second tag
    });
    
    await waitFor(() => {
      const mergeButton = screen.getByText('Merge');
      fireEvent.click(mergeButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Merge Tags')).toBeInTheDocument();
      expect(screen.getByText(/Select the target tag to merge.*selected tags into/)).toBeInTheDocument();
    });
  });

  it('performs tag merge', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // Select JavaScript
      fireEvent.click(checkboxes[1]); // Select React
    });
    
    const mergeButton = screen.getByRole('button', { name: /Merge/ });
    fireEvent.click(mergeButton);
    
    // Select target tag
    const targetSelect = screen.getByDisplayValue('Select target tag...');
    fireEvent.change(targetSelect, { target: { value: '3' } }); // Unused Tag
    
    const mergeTagsButton = screen.getByRole('button', { name: 'Merge Tags' });
    fireEvent.click(mergeTagsButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/tags/merge',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetTagId: '3',
            sourceTagIds: ['1', '2']
          })
        })
      );
    });
  });

  it('cancels merge dialog', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // Select first tag
      fireEvent.click(checkboxes[1]); // Select second tag
    });
    
    const mergeButton = screen.getByRole('button', { name: /Merge/ });
    fireEvent.click(mergeButton);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(screen.queryByRole('heading', { name: 'Merge Tags' })).not.toBeInTheDocument();
  });

  it('shows unused tag indicator', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      expect(screen.getAllByText('unused').length).toBeGreaterThan(0);
    });
  });

  it('deletes selected tags', async () => {
    await renderTagManager();
    
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[2]); // Select unused tag
    });
    
    const deleteButton = screen.getByText('Delete Selected (1)');
    fireEvent.click(deleteButton);

    const confirmButton = await screen.findByRole('button', { name: 'Delete tag' });
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/tags/bulk',
        expect.objectContaining({
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tagIds: ['3']
          })
        })
      );
    });
  });
});
