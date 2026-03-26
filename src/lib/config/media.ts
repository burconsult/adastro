export const MAX_MEDIA_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB
export const DIRECT_MEDIA_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024; // 4MB
export const MEDIA_STAGING_FOLDER = 'staging';

export const MEDIA_SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'application/pdf'
] as const;

export const isSupportedMediaMimeType = (mimeType: string): boolean =>
  MEDIA_SUPPORTED_MIME_TYPES.includes(mimeType as (typeof MEDIA_SUPPORTED_MIME_TYPES)[number]);

export const formatMediaUploadLimitMb = (bytes: number) => Math.round(bytes / (1024 * 1024));
