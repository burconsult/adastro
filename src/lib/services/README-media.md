# Media Pipeline

This document describes the current media ownership and upload flow. Method signatures in `media-manager.ts`, `cdn-manager.ts`, and their tests remain authoritative.

## Flow

```text
Browser upload
  -> validated staged upload
  -> server-side MediaManager
  -> Supabase Storage
  -> media metadata row
  -> provider-aware delivery URL
```

Browser code uses `src/lib/media/upload-client.ts`; it does not receive the Supabase secret key. Server routes validate size, MIME type, authorization, and storage paths before `MediaManager` processes the file.

## Storage Model

- The media bucket is derived per installation unless `MEDIA_STORAGE_BUCKET` overrides it.
- Staged browser uploads use the configured staging folder and are removed after processing.
- Images retain original metadata and a public optimized asset.
- Public assets normally live under `uploads/`; originals live under `originals/`.
- The shared upload limit and MIME policy live in `src/lib/config/media.ts`.

## Main Components

| Component | Responsibility |
| --- | --- |
| `media-manager.ts` | Upload, validation, image optimization, metadata, deletion, usage, and recommendations |
| `cdn-manager.ts` | Provider-aware image URLs for Vercel, Netlify, Cloudflare, or custom delivery |
| `media/upload-client.ts` | Browser-to-server staged upload flow |
| `components/MediaUpload.tsx` | Drag/drop and progress UI |
| `components/MediaManager.tsx` | Admin media management |
| `components/OptimizedImage.tsx` | Responsive React rendering |
| `components/ResponsiveImage.astro` | Responsive Astro rendering |

## Server Usage

```typescript
import { mediaManager } from '@/lib/services';

const result = await mediaManager.uploadMedia({
  file,
  altText,
  caption,
  uploadedBy
});
```

`MediaOptimizationResult` exposes the registered public asset plus original/optimization metadata. Consult `src/lib/types/index.ts` for the current shape.

## Delivery Configuration

The default host adapter selects the matching image delivery behavior. These variables are optional overrides:

```bash
IMAGE_CDN_PROVIDER=
IMAGE_CDN_BASE_URL=
IMAGE_CDN_API_KEY=
IMAGE_CDN_ZONE_ID=
MEDIA_STORAGE_BUCKET=
```

Vercel format negotiation is handled by the platform image service. Netlify and supported custom providers may use explicit format transformations.

## Safety and Verification

- Never import `MediaManager` into browser code.
- Treat filenames, MIME types, external URLs, and staged storage paths as untrusted.
- Keep upload and deletion authorization in server routes.
- Preserve original media until the registered public asset and metadata write succeed.
- Test both storage cleanup and metadata cleanup on failures.

Relevant coverage:

- `src/lib/services/__tests__/media-manager.test.ts`
- `src/lib/services/__tests__/media-manager.integration.test.ts`
- `src/lib/services/__tests__/cdn-manager.test.ts`
- `src/pages/api/admin/media/__tests__/`
