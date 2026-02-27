export const MAX_MEDIA_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

export const formatMediaUploadLimitMb = (bytes: number) => Math.round(bytes / (1024 * 1024));
