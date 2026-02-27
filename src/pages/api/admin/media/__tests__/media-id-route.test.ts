import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuthor: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  deleteMediaAsset: vi.fn(),
  ownershipMaybeSingle: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAuthor: mocks.requireAuthor
}));

vi.mock('@/lib/database/repositories/media-repository', () => ({
  MediaRepository: vi.fn().mockImplementation(() => ({
    findById: mocks.findById,
    update: mocks.update
  }))
}));

vi.mock('@/lib/services/media-manager.js', () => ({
  mediaManager: {
    deleteMediaAsset: mocks.deleteMediaAsset
  }
}));

vi.mock('@/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: mocks.ownershipMaybeSingle
        })
      })
    })
  }
}));

import { DELETE, GET } from '../[id].ts';

describe('admin media [id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthor.mockResolvedValue({ id: 'admin-1', role: 'admin', authorId: null });
  });

  it('handles GET without request reference errors and returns 404 when asset is missing', async () => {
    mocks.findById.mockResolvedValue(null);
    const request = new Request('http://localhost/api/admin/media/missing');

    const response = await GET({
      request,
      params: { id: 'missing' }
    } as any);
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toMatch(/not found/i);
    expect(mocks.requireAuthor).toHaveBeenCalledWith(request);
  });

  it('handles DELETE without request reference errors and returns 204 on success', async () => {
    mocks.deleteMediaAsset.mockResolvedValue(undefined);
    const request = new Request('http://localhost/api/admin/media/asset-1');

    const response = await DELETE({
      request,
      params: { id: 'asset-1' }
    } as any);

    expect(response.status).toBe(204);
    expect(mocks.requireAuthor).toHaveBeenCalledWith(request);
    expect(mocks.deleteMediaAsset).toHaveBeenCalledWith('asset-1');
  });
});
