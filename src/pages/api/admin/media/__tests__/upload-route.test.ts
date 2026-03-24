import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuthor: vi.fn(),
  uploadMedia: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAuthor: mocks.requireAuthor
}));

vi.mock('@/lib/services/media-manager.js', () => ({
  mediaManager: {
    uploadMedia: mocks.uploadMedia
  }
}));

vi.mock('@/lib/services/cdn-manager.js', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/cdn-manager.js')>('@/lib/services/cdn-manager.js');
  return {
    ...actual,
    cdnManager: actual.createCDNManager({ provider: 'netlify' })
  };
});

import { POST } from '../upload.ts';

describe('admin media upload api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthor.mockResolvedValue({ id: 'admin-1', role: 'admin', authorId: 'author-1' });
    mocks.uploadMedia.mockResolvedValue({
      original: {
        id: 'media-1',
        filename: 'hero.jpg',
        url: 'https://example.com/uploads/hero.jpg',
        storagePath: 'uploads/hero.jpg',
        altText: 'Hero image',
        caption: null,
        mimeType: 'image/jpeg',
        fileSize: 2048,
        createdAt: new Date('2026-03-01T00:00:00.000Z')
      },
      public: {
        id: 'media-1',
        filename: 'hero.jpg',
        url: 'https://example.com/uploads/hero.jpg',
        storagePath: 'uploads/hero.jpg',
        altText: 'Hero image',
        caption: null,
        mimeType: 'image/jpeg',
        fileSize: 2048,
        createdAt: new Date('2026-03-01T00:00:00.000Z')
      }
    });
  });

  it('returns Netlify-safe responsive image URLs', async () => {
    const formData = new FormData();
    formData.set('file', new File(['hello'], 'hero.jpg', { type: 'image/jpeg' }));

    const response = await POST({
      request: {
        formData: async () => formData
      }
    } as any);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.responsiveUrls.thumbnail).toContain('/.netlify/images?');
    expect(payload.responsiveUrls.thumbnail).toContain('fit=cover');
    expect(payload.responsiveUrls.medium).toContain('w=800');
    expect(payload.public.url).toBe('https://example.com/uploads/hero.jpg');
  });
});
