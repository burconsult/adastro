import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CategoryRepository } from '../category-repository';

describe('CategoryRepository Enhanced Features', () => {
  let categoryRepo: CategoryRepository;
  let mockDb: any;

  beforeEach(() => {
    categoryRepo = new CategoryRepository(true);
    mockDb = {
      executeQuery: vi.fn(),
      executeArrayQuery: vi.fn(),
      executeOptionalQuery: vi.fn()
    };
    (categoryRepo as any).db = mockDb;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows updating category when slug is unchanged', async () => {
    const dbRow = {
      id: '1',
      name: 'Updated Category',
      slug: 'category',
      description: null,
      parent_id: null,
      created_at: '2023-01-01T00:00:00Z',
    };

    mockDb.executeQuery.mockResolvedValue({
      id: dbRow.id,
      name: dbRow.name,
      slug: dbRow.slug,
      description: undefined,
      parentId: undefined,
      createdAt: new Date(dbRow.created_at),
    });

    vi.spyOn(categoryRepo, 'findBySlug').mockResolvedValue({
      id: '1',
      name: 'Original Category',
      slug: 'category',
      createdAt: new Date('2023-01-01T00:00:00Z'),
    });

    const result = await categoryRepo.update('1', { name: 'Updated Category', slug: 'category' });

    expect(result).toMatchObject({
      id: '1',
      name: 'Updated Category',
      slug: 'category',
    });
    expect(mockDb.executeQuery).toHaveBeenCalled();
  });

  it('prevents updating category when slug belongs to another category', async () => {
    vi.spyOn(categoryRepo, 'findBySlug').mockResolvedValue({
      id: '2',
      name: 'Another Category',
      slug: 'duplicate',
      createdAt: new Date(),
    });

    await expect(categoryRepo.update('1', { slug: 'duplicate' })).rejects.toThrow('Category with this slug already exists');
    expect(mockDb.executeQuery).not.toHaveBeenCalled();
  });

  it('returns usage count for a category', async () => {
    mockDb.executeQuery.mockResolvedValue({ count: 3 });

    const count = await categoryRepo.getUsageCount('1');
    expect(count).toBe(3);
    expect(mockDb.executeQuery).toHaveBeenCalled();
  });
});
