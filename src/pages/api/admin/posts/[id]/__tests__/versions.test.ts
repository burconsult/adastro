import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '@/lib/database/connection';

const mocks = vi.hoisted(() => ({
  requireAuthor: vi.fn(),
  findByIdWithRelations: vi.fn(),
  findVersions: vi.fn(),
  restoreVersion: vi.fn(),
  recordAuditEvent: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAuthor: mocks.requireAuthor
}));

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: mocks.recordAuditEvent
}));

vi.mock('@/lib/database/repositories/post-repository', () => ({
  PostRepository: vi.fn().mockImplementation(() => ({
    findByIdWithRelations: mocks.findByIdWithRelations,
    findVersions: mocks.findVersions,
    restoreVersion: mocks.restoreVersion
  }))
}));

import { GET, POST } from '../versions.ts';

describe('post version history route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthor.mockResolvedValue({
      id: 'user-1',
      role: 'author',
      authorId: 'author-1'
    });
    mocks.findByIdWithRelations.mockResolvedValue({
      id: 'post-1',
      author: { id: 'author-1' }
    });
    mocks.findVersions.mockResolvedValue([{ id: 'version-1', versionNumber: 1 }]);
    mocks.restoreVersion.mockResolvedValue({ id: 'post-1', title: 'Restored' });
  });

  it('returns a bounded version list for the owning author', async () => {
    const response = await GET({
      request: new Request('http://localhost/api/admin/posts/post-1/versions'),
      params: { id: 'post-1' }
    } as any);

    expect(response.status).toBe(200);
    expect(mocks.findVersions).toHaveBeenCalledWith('post-1', 20);
  });

  it('does not expose another author’s history', async () => {
    mocks.findByIdWithRelations.mockResolvedValue({
      id: 'post-1',
      author: { id: 'author-2' }
    });

    const response = await GET({
      request: new Request('http://localhost/api/admin/posts/post-1/versions'),
      params: { id: 'post-1' }
    } as any);

    expect(response.status).toBe(403);
    expect(mocks.findVersions).not.toHaveBeenCalled();
  });

  it('preserves ownership when an author restores a version', async () => {
    const response = await POST({
      request: new Request('http://localhost/api/admin/posts/post-1/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: 'version-1' })
      }),
      params: { id: 'post-1' }
    } as any);

    expect(response.status).toBe(200);
    expect(mocks.restoreVersion).toHaveBeenCalledWith('post-1', 'version-1', {
      actorAuthorId: 'author-1',
      preserveAuthorId: true
    });
  });

  it('returns 404 when the selected version does not belong to the post', async () => {
    mocks.restoreVersion.mockRejectedValue(new NotFoundError('Post version', 'missing'));

    const response = await POST({
      request: new Request('http://localhost/api/admin/posts/post-1/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: 'missing' })
      }),
      params: { id: 'post-1' }
    } as any);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Post version not found'
    });
  });
});
