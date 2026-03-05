import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuthor: vi.fn(),
  findWithFilters: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAuthor: mocks.requireAuthor
}));

vi.mock('@/lib/database/repositories/post-repository', () => ({
  PostRepository: vi.fn().mockImplementation(() => ({
    findWithFilters: mocks.findWithFilters
  }))
}));

import { GET } from '../../posts.ts';

describe('admin posts api (list)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthor.mockResolvedValue({ id: 'admin-1', role: 'admin', authorId: 'author-1' });
    mocks.findWithFilters.mockResolvedValue([]);
  });

  it('normalizes missing query params to undefined filters', async () => {
    const request = new Request('https://www.adastro.no/api/admin/posts?locale=nb');
    const response = await GET({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual([]);
    expect(mocks.findWithFilters).toHaveBeenCalledWith({
      status: undefined,
      search: undefined,
      locale: 'nb',
      categoryId: undefined,
      tagId: undefined,
      authorId: undefined,
      limit: 20,
      offset: 0
    });
  });

  it('passes category and tag filters through when provided', async () => {
    const request = new Request(
      'https://www.adastro.no/api/admin/posts?status=published&search=astro&locale=en&category=11111111-1111-1111-1111-111111111111&tag=22222222-2222-2222-2222-222222222222&limit=10&offset=20'
    );
    const response = await GET({ request } as any);

    expect(response.status).toBe(200);
    expect(mocks.findWithFilters).toHaveBeenCalledWith({
      status: 'published',
      search: 'astro',
      locale: 'en',
      categoryId: '11111111-1111-1111-1111-111111111111',
      tagId: '22222222-2222-2222-2222-222222222222',
      authorId: undefined,
      limit: 10,
      offset: 20
    });
  });
});
