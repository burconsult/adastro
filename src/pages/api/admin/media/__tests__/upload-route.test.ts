import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuthor: vi.fn(),
  uploadMedia: vi.fn(),
  uploadMediaFromStorage: vi.fn(),
  recordAuditEvent: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAuthor: mocks.requireAuthor
}));

vi.mock('@/lib/services/media-manager.js', () => ({
  mediaManager: {
    uploadMedia: mocks.uploadMedia,
    uploadMediaFromStorage: mocks.uploadMediaFromStorage
  }
}));

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: mocks.recordAuditEvent
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
    mocks.uploadMediaFromStorage.mockResolvedValue({
      original: {
        id: 'media-2',
        filename: 'guide.pdf',
        url: 'https://example.com/uploads/guide.pdf',
        storagePath: 'uploads/guide.pdf',
        altText: 'Guide',
        caption: null,
        mimeType: 'application/pdf',
        fileSize: 4096,
        createdAt: new Date('2026-03-01T00:00:00.000Z')
      },
      public: {
        id: 'media-2',
        filename: 'guide.pdf',
        url: 'https://example.com/uploads/guide.pdf',
        storagePath: 'uploads/guide.pdf',
        altText: 'Guide',
        caption: null,
        mimeType: 'application/pdf',
        fileSize: 4096,
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
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'media.upload',
      entityType: 'media',
      entityId: 'media-1',
      entityLabel: 'hero.jpg'
    }));
  });

  it('accepts staged uploads that were sent directly to storage', async () => {
    const formData = new FormData();
    formData.set('storagePath', 'staging/upload-1-guide.pdf');
    formData.set('filename', 'guide.pdf');
    formData.set('mimeType', 'application/pdf');

    const response = await POST({
      request: {
        formData: async () => formData
      }
    } as any);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.uploadMediaFromStorage).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePath: 'staging/upload-1-guide.pdf',
        filename: 'guide.pdf',
        mimeType: 'application/pdf'
      })
    );
    expect(payload.public.mimeType).toBe('application/pdf');
  });
});
