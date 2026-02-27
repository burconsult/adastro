import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findById: vi.fn(),
  getUsageCount: vi.fn(),
  deleteCategory: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAdmin: mocks.requireAdmin
}));

vi.mock('@/lib/database/repositories/category-repository', () => ({
  CategoryRepository: vi.fn().mockImplementation(() => ({
    findById: mocks.findById,
    getUsageCount: mocks.getUsageCount,
    delete: mocks.deleteCategory
  }))
}));

import { DELETE, GET } from '../[id].ts';

describe('admin category [id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: 'admin-1' });
  });

  it('handles GET with request context and returns 404 for missing category', async () => {
    mocks.findById.mockResolvedValue(null);
    const request = new Request('http://localhost/api/admin/categories/missing');

    const response = await GET({
      request,
      params: { id: 'missing' }
    } as any);
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toMatch(/not found/i);
    expect(mocks.requireAdmin).toHaveBeenCalledWith(request);
  });

  it('handles DELETE with request context and returns 400 when id is missing', async () => {
    const request = new Request('http://localhost/api/admin/categories');

    const response = await DELETE({
      request,
      params: {}
    } as any);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/required/i);
    expect(mocks.requireAdmin).toHaveBeenCalledWith(request);
  });
});
