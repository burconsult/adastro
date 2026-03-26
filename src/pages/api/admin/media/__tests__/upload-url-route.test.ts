import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuthor: vi.fn(),
  getStorageBucketConfig: vi.fn(),
  createSignedUploadUrl: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAuthor: mocks.requireAuthor
}));

vi.mock('@/lib/storage/buckets', () => ({
  getStorageBucketConfig: mocks.getStorageBucketConfig
}));

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: vi.fn(() => ({
        createSignedUploadUrl: mocks.createSignedUploadUrl
      }))
    }
  }
}));

import { POST } from '../upload-url.ts';

describe('admin media upload url api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthor.mockResolvedValue({ id: 'admin-1', role: 'admin', authorId: 'author-1' });
    mocks.getStorageBucketConfig.mockResolvedValue({ media: 'media-assets' });
    mocks.createSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl: 'https://example.supabase.co/storage/v1/upload',
        path: 'staging/test-file.pdf'
      },
      error: null
    });
  });

  it('creates a signed upload url for supported media', async () => {
    const response = await POST({
      request: {
        json: async () => ({
          filename: 'Guide.pdf',
          mimeType: 'application/pdf',
          fileSize: 4096
        })
      }
    } as any);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.signedUrl).toBe('https://example.supabase.co/storage/v1/upload');
    expect(payload.path).toBe('staging/test-file.pdf');
  });

  it('rejects unsupported mime types', async () => {
    const response = await POST({
      request: {
        json: async () => ({
          filename: 'malware.exe',
          mimeType: 'application/x-msdownload',
          fileSize: 4096
        })
      }
    } as any);

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Unsupported file type');
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });
});
