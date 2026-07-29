import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '@/lib/database/connection';

const mocks = vi.hoisted(() => ({
  requireAuthor: vi.fn(),
  findByIdWithRelations: vi.fn(),
  findVersions: vi.fn(),
  restoreVersion: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAuthor: mocks.requireAuthor
}));

vi.mock('@/lib/database/repositories/page-repository', () => ({
  PageRepository: vi.fn().mockImplementation(() => ({
    findByIdWithRelations: mocks.findByIdWithRelations,
    findVersions: mocks.findVersions,
    restoreVersion: mocks.restoreVersion
  }))
}));

import { GET, POST } from '../versions.ts';

describe('page version history route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthor.mockResolvedValue({
      id: 'user-1',
      role: 'author',
      authorId: 'author-1'
    });
    mocks.findByIdWithRelations.mockResolvedValue({
      id: 'page-1',
      author: { id: 'author-1' }
    });
    mocks.findVersions.mockResolvedValue([{ id: 'version-1', versionNumber: 1 }]);
    mocks.restoreVersion.mockResolvedValue({ id: 'page-1', title: 'Restored' });
  });

  it('returns a bounded version list for the owning author', async () => {
    const response = await GET({
      request: new Request('http://localhost/api/admin/pages/page-1/versions'),
      params: { id: 'page-1' }
    } as any);

    expect(response.status).toBe(200);
    expect(mocks.findVersions).toHaveBeenCalledWith('page-1', 20);
  });

  it('does not expose another author’s history', async () => {
    mocks.findByIdWithRelations.mockResolvedValue({
      id: 'page-1',
      author: { id: 'author-2' }
    });

    const response = await GET({
      request: new Request('http://localhost/api/admin/pages/page-1/versions'),
      params: { id: 'page-1' }
    } as any);

    expect(response.status).toBe(403);
    expect(mocks.findVersions).not.toHaveBeenCalled();
  });

  it('preserves ownership when an author restores a version', async () => {
    const response = await POST({
      request: new Request('http://localhost/api/admin/pages/page-1/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: 'version-1' })
      }),
      params: { id: 'page-1' }
    } as any);

    expect(response.status).toBe(200);
    expect(mocks.restoreVersion).toHaveBeenCalledWith('page-1', 'version-1', {
      actorAuthorId: 'author-1',
      preserveAuthorId: true
    });
  });

  it('returns 404 when the selected version does not belong to the page', async () => {
    mocks.restoreVersion.mockRejectedValue(new NotFoundError('Page version', 'missing'));

    const response = await POST({
      request: new Request('http://localhost/api/admin/pages/page-1/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: 'missing' })
      }),
      params: { id: 'page-1' }
    } as any);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Page version not found'
    });
  });
});
