import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { requireAuthor } from '@/lib/auth/auth-helpers';
import {
  DIRECT_MEDIA_UPLOAD_THRESHOLD_BYTES,
  isSupportedMediaMimeType,
  MAX_MEDIA_UPLOAD_BYTES,
  MEDIA_STAGING_FOLDER
} from '@/lib/config/media';
import { getStorageBucketConfig } from '@/lib/storage/buckets';
import { supabaseAdmin } from '@/lib/supabase';

const sanitizeFilename = (filename: string): string =>
  filename.replace(/[^a-z0-9._-]/gi, '-').replace(/-+/g, '-').toLowerCase();

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuthor(request);
    if (user.role !== 'admin' && !user.authorId) {
      return new Response(JSON.stringify({ error: 'Author profile not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { filename, mimeType, fileSize } = await request.json();

    if (!filename || typeof filename !== 'string') {
      return new Response(JSON.stringify({ error: 'filename is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!mimeType || typeof mimeType !== 'string' || !isSupportedMediaMimeType(mimeType)) {
      return new Response(JSON.stringify({ error: 'Unsupported file type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (typeof fileSize === 'number' && fileSize > MAX_MEDIA_UPLOAD_BYTES) {
      return new Response(JSON.stringify({
        error: `File is too large. Maximum upload size is ${Math.round(MAX_MEDIA_UPLOAD_BYTES / (1024 * 1024))}MB.`
      }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { media: mediaBucket } = await getStorageBucketConfig();
    const safeName = sanitizeFilename(filename);
    const path = `${MEDIA_STAGING_FOLDER}/${randomUUID()}-${safeName}`;

    const { data, error } = await supabaseAdmin.storage
      .from(mediaBucket)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error('Media upload URL creation failed:', error);
      return new Response(JSON.stringify({ error: 'Failed to create upload URL' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      signedUrl: data.signedUrl,
      path: data.path || path,
      maxBytes: MAX_MEDIA_UPLOAD_BYTES,
      directUploadThresholdBytes: DIRECT_MEDIA_UPLOAD_THRESHOLD_BYTES
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Media upload init failed:', error);
    return new Response(JSON.stringify({ error: 'Upload init failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
