-- Migration: Expand media bucket MIME support
-- Created: 2026-03-26
-- Description: Align storage bucket MIME allowances with media library upload support

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/gif',
  'image/png',
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
]
WHERE id = public.media_storage_bucket();
