import {
  DIRECT_MEDIA_UPLOAD_THRESHOLD_BYTES,
  MAX_MEDIA_UPLOAD_BYTES
} from '@/lib/config/media';
import type { MediaOptimizationResult } from '@/lib/services/media-manager.js';

export interface BrowserMediaUploadOptions {
  file: File;
  altText?: string;
  caption?: string;
  onProgress?: (progress: { stage: string; progress: number }) => void;
}

type UploadInitPayload = {
  signedUrl?: string;
  path?: string;
  error?: string;
};

const readJson = async <T>(response: Response): Promise<T | null> => (
  response.json().catch(() => null)
);

export async function uploadMediaFromBrowser(
  options: BrowserMediaUploadOptions
): Promise<MediaOptimizationResult> {
  const { file, altText, caption, onProgress } = options;

  if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
    throw new Error(`File size exceeds ${Math.round(MAX_MEDIA_UPLOAD_BYTES / (1024 * 1024))}MB limit`);
  }

  const formData = new FormData();
  if (altText?.trim()) {
    formData.append('altText', altText.trim());
  }
  if (caption?.trim()) {
    formData.append('caption', caption.trim());
  }

  if (file.size > DIRECT_MEDIA_UPLOAD_THRESHOLD_BYTES) {
    onProgress?.({ stage: 'Preparing direct upload...', progress: 10 });

    const initResponse = await fetch('/api/admin/media/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size
      })
    });

    const initPayload = await readJson<UploadInitPayload>(initResponse);
    if (!initResponse.ok || !initPayload?.signedUrl || !initPayload.path) {
      throw new Error(initPayload?.error || 'Failed to prepare upload');
    }

    onProgress?.({ stage: 'Uploading directly to storage...', progress: 40 });

    const uploadResponse = await fetch(initPayload.signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file to storage.');
    }

    formData.append('storagePath', initPayload.path);
    formData.append('filename', file.name);
    formData.append('mimeType', file.type || 'application/octet-stream');
  } else {
    formData.append('file', file);
  }

  onProgress?.({ stage: 'Processing media...', progress: 75 });

  const response = await fetch('/api/admin/media/upload', {
    method: 'POST',
    body: formData
  });

  const payload = await readJson<MediaOptimizationResult & { error?: string; message?: string }>(response);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || 'Upload failed');
  }

  onProgress?.({ stage: 'Complete!', progress: 100 });

  return payload as MediaOptimizationResult;
}
