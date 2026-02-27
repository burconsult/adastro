import type { APIRoute } from 'astro';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/auth/auth-helpers';
import { getStorageBucketConfig } from '@/lib/storage/buckets';
import { supabaseAdmin } from '@/lib/supabase';

const MAX_MIGRATION_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB

const sanitizeFilename = (filename: string): string =>
  filename.replace(/[^a-z0-9._-]/gi, '-').replace(/-+/g, '-').toLowerCase();

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const { migrationUploads: migrationBucket } = await getStorageBucketConfig();

    const { filename } = await request.json();
    if (!filename || typeof filename !== 'string') {
      return new Response(JSON.stringify({ error: 'filename is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (filename.length > 255) {
      return new Response(JSON.stringify({ error: 'filename is too long' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const safeName = sanitizeFilename(filename);
    if (!safeName.endsWith('.xml') && !safeName.endsWith('.wxr')) {
      return new Response(JSON.stringify({ error: 'Only .xml or .wxr files are supported' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const path = `wxr/${randomUUID()}-${safeName}`;

    const { data, error } = await supabaseAdmin.storage
      .from(migrationBucket)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error('Migration upload URL creation failed:', error);
      return new Response(JSON.stringify({ error: 'Failed to create upload URL' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      signedUrl: data.signedUrl,
      path: data.path || path,
      maxBytes: MAX_MIGRATION_UPLOAD_BYTES
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Upload init failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
