import type { APIRoute } from 'astro';
import { requireAuthor } from '@/lib/auth/auth-helpers';
import { mediaManager } from '@/lib/services/media-manager.js';
import { MAX_MEDIA_UPLOAD_BYTES } from '@/lib/config/media.js';
import { cdnManager } from '@/lib/services/cdn-manager.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuthor(request);
    const uploadedBy = user.authorId;

    // Admin users can upload media even when no author profile row exists yet.
    if (user.role !== 'admin' && !uploadedBy) {
      return new Response(JSON.stringify({ error: 'Author profile not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (typeof file.size === 'number' && file.size > MAX_MEDIA_UPLOAD_BYTES) {
      return new Response(JSON.stringify({
        error: `File is too large. Maximum upload size is ${Math.round(MAX_MEDIA_UPLOAD_BYTES / (1024 * 1024))}MB.`
      }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const caption = formData.get('caption')?.toString();
    const providedAltText = formData.get('altText')?.toString();

    const result = await mediaManager.uploadMedia({
      file,
      altText: providedAltText?.trim() || undefined,
      caption,
      uploadedBy
    });

    const primaryAsset = result.public ?? result.original;
    const responsiveUrls = cdnManager.generateResponsiveUrls(primaryAsset);

    return new Response(
      JSON.stringify({
        ...result,
        public: primaryAsset,
        responsiveUrls
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Media upload failed:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to upload media',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
