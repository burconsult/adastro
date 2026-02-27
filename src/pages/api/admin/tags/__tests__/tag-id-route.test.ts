import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findById: vi.fn(),
  getUsageCount: vi.fn(),
  deleteTag: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAdmin: mocks.requireAdmin
}));

vi.mock('@/lib/database/repositories/tag-repository', () => ({
  TagRepository: vi.fn().mockImplementation(() => ({
    findById: mocks.findById,
    getUsageCount: mocks.getUsageCount,
    delete: mocks.deleteTag
  }))
}));

import { DELETE, GET } from '../[id].ts';

describe('admin tag [id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: 'admin-1' });
  });

  it('handles GET with request context and returns 404 for missing tag', async () => {
    mocks.findById.mockResolvedValue(null);
    const request = new Request('http://localhost/api/admin/tags/missing');

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
    const request = new Request('http://localhost/api/admin/tags');

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
