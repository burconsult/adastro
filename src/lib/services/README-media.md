# Media Management System

A comprehensive media management system for the Adastro platform, featuring automatic image optimization, CDN integration, and responsive image generation.

## Features

### 🚀 Core Capabilities
- **Lightweight Optimization**: Store the original plus a single standard derivative
- **Responsive Delivery**: Let Astro/CDN generate responsive sizes at request time
- **CDN Integration**: Support for Vercel, Cloudflare, and custom CDN providers
- **Smart Alt Text Generation**: AI-assisted alt text suggestions for accessibility
- **Media Analytics**: Usage statistics and optimization recommendations
- **Bulk Operations**: Efficient batch processing for media management

### 📊 Performance Benefits
- **Format Optimization**: Up to 50% file size reduction with WebP/AVIF
- **Responsive Delivery**: Serve appropriately sized images for each device
- **CDN Acceleration**: Global content delivery with edge caching
- **Lazy Loading**: Improved page load times with progressive image loading

## Quick Start

### Basic Usage

```typescript
import { mediaManager, cdnManager } from '@/lib/services';

// Upload and register an image
const result = await mediaManager.uploadMedia({
  file: imageFile,
  altText: 'Product showcase image'
});

// Generate CDN-optimized URL
const optimizedUrl = cdnManager.generateOptimizedUrl(result.public ?? result.original, {
  width: 800,
  format: 'webp',
  quality: 85
});
```

### React Components

```tsx
import { OptimizedImage, MediaUpload } from '@/lib/components';

// Display optimized image with responsive sources
<OptimizedImage
  asset={mediaAsset}
  alt="Hero image"
  className="hero-image"
  priority={true}
  sizes="100vw"
/>

// Upload interface with progress tracking
<MediaUpload
  onUploadComplete={(result) => {
    console.log('Upload complete:', result);
  }}
/>
```

## API Reference

### MediaManager

#### `uploadMedia(options: MediaUploadOptions): Promise<MediaOptimizationResult>`

Upload and process a media file with automatic optimization.

**Parameters:**
- `file: File` - The file to upload
- `altText?: string` - Alt text for accessibility
- `caption?: string` - Image caption

**Returns:**
```typescript
{
  original: MediaAsset;
  public?: MediaAsset;
  standard?: MediaAsset;
  optimized: MediaAsset[];
  sizeSavings: number;
  formatConversions: string[];
}
```

`public` is the web-optimized asset used for display. The returned `MediaAsset` includes optional `original*` metadata fields so the original file can be retrieved from storage.

#### `getMediaAsset(id: string): Promise<MediaAsset | null>`

Retrieve a media asset by ID.

#### `listMediaAssets(options): Promise<{ assets: MediaAsset[], total: number }>`

List media assets with filtering and pagination.

**Options:**
- `limit?: number` - Number of assets to return (default: 20)
- `offset?: number` - Pagination offset (default: 0)
- `mimeType?: string` - Filter by MIME type (e.g., 'image')
- `search?: string` - Search in filename, alt text, and caption

#### `updateMediaAsset(id: string, updates): Promise<MediaAsset>`

Update media asset metadata.

**Updates:**
- `altText?: string` - New alt text
- `caption?: string` - New caption
- `filename?: string` - New filename

#### `deleteMediaAsset(id: string): Promise<void>`

Delete a media asset and clean up storage.

#### `bulkDeleteMediaAssets(ids: string[]): Promise<{ deleted: string[], failed: string[] }>`

Delete multiple media assets in batch.

#### `getMediaUsageStats(): Promise<MediaUsageStats>`

Get comprehensive media usage statistics.

**Returns:**
```typescript
{
  totalFiles: number;
  totalSize: number;
  formatDistribution: Record<string, number>;
  averageFileSize: number;
  optimizationSavings: number;
}
```

#### `getOptimizationRecommendations(): Promise<OptimizationRecommendations>`

Get recommendations for media optimization.

**Returns:**
```typescript
{
  oversizedImages: MediaAsset[];
  unoptimizedFormats: MediaAsset[];
  missingAltText: MediaAsset[];
  totalPotentialSavings: number;
}
```

#### `generateAltTextSuggestion(asset: MediaAsset): Promise<string>`

Generate AI-assisted alt text suggestions.

### CDNManager

#### `generateOptimizedUrl(asset: MediaAsset, options: ImageTransformOptions): string`

Generate CDN-optimized URL with transformations.

**Options:**
- `width?: number` - Target width
- `height?: number` - Target height
- `quality?: number` - Image quality (1-100)
- `format?: 'webp' | 'avif' | 'jpeg' | 'png'` - Output format
- `fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'` - Resize behavior

#### `generateResponsiveUrls(asset: MediaAsset): ResponsiveUrls`

Generate URLs for all responsive breakpoints.

**Returns:**
```typescript
{
  thumbnail: string;  // 150px
  small: string;      // 400px
  medium: string;     // 800px
  large: string;      // 1200px
  xlarge: string;     // 1920px
}
```

#### `generatePictureElement(asset: MediaAsset, options): string`

Generate complete HTML picture element with multiple sources.

#### `purgeCacheUrls(urls: string[]): Promise<void>`

Purge CDN cache for specific URLs (Cloudflare support).

#### `getCDNAnalytics(timeRange): Promise<CDNAnalytics>`

Get CDN performance analytics.

## Configuration

### CDN Setup

```typescript
import { createCDNManager } from '@/lib/services';

// Vercel (default)
const vercelCDN = createCDNManager({ provider: 'vercel' });

// Cloudflare
const cloudflareCDN = createCDNManager({
  provider: 'cloudflare',
  baseUrl: process.env.IMAGE_CDN_BASE_URL,
  apiKey: process.env.IMAGE_CDN_API_KEY,
  zoneId: process.env.IMAGE_CDN_ZONE_ID
});

// Custom CDN
const customCDN = createCDNManager({
  provider: 'custom',
  baseUrl: process.env.IMAGE_CDN_BASE_URL
});
```

### Environment Variables

```env
SUPABASE_URL=your-supabase-url
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key

# Optional CDN configuration
IMAGE_CDN_PROVIDER=vercel        # vercel | cloudflare | custom
IMAGE_CDN_BASE_URL=https://cdn.example.com
IMAGE_CDN_API_KEY=your-cloudflare-api-key
IMAGE_CDN_ZONE_ID=your-zone-id
```

## Database Schema

The media management system uses the following database table:

```sql
CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  alt_text TEXT,
  caption TEXT,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  dimensions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_media_assets_mime_type ON media_assets(mime_type);
CREATE INDEX idx_media_assets_created_at ON media_assets(created_at);
CREATE INDEX idx_media_assets_file_size ON media_assets(file_size);
```

## Storage Structure

```
media-assets/
├── uploads/
│   ├── 1640995200000-hero.jpg
│   └── 1640995200000-hero-standard.jpg
```

## Performance Optimization

### Image Optimization Pipeline

1. **Upload**: Original file uploaded to Supabase Storage
2. **Metadata**: Image dimensions and captions stored once
3. **Standard Variant**: A single `-standard` derivative generated when the original is oversized
4. **Delivery**: Astro/CDN integrations generate responsive sizes and modern formats on the fly

### Best Practices

1. **Use appropriate image formats**:
   - AVIF for modern browsers (best compression)
   - WebP for wide browser support
   - JPEG/PNG as fallback

2. **Implement responsive images**:
   ```tsx
   <OptimizedImage
     asset={asset}
     sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
   />
   ```

3. **Prioritize critical images**:
   ```tsx
   <HeroImage asset={heroAsset} priority={true} />
   ```

4. **Use lazy loading for non-critical images**:
   ```tsx
   <ContentImage asset={asset} loading="lazy" />
   ```

## Analytics and Monitoring

### Usage Statistics

```typescript
const stats = await mediaManager.getMediaUsageStats();
console.log(`Total files: ${stats.totalFiles}`);
console.log(`Storage used: ${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`);
console.log(`Optimization savings: ${(stats.optimizationSavings / 1024 / 1024).toFixed(2)}MB`);
```

### Optimization Recommendations

```typescript
const recommendations = await mediaManager.getOptimizationRecommendations();
console.log(`Oversized images: ${recommendations.oversizedImages.length}`);
console.log(`Potential savings: ${(recommendations.totalPotentialSavings / 1024 / 1024).toFixed(2)}MB`);
```

### CDN Analytics

```typescript
const analytics = await cdnManager.getCDNAnalytics('7d');
console.log(`Cache hit rate: ${(analytics.cacheHitRate * 100).toFixed(1)}%`);
console.log(`Bandwidth saved: ${(analytics.bandwidthSaved / 1024 / 1024).toFixed(2)}MB`);
```

## Error Handling

The media management system includes comprehensive error handling:

```typescript
try {
  const result = await mediaManager.uploadMedia({ file });
} catch (error) {
  if (error.message.includes('Unsupported file type')) {
    // Handle invalid file type
  } else if (error.message.includes('Upload failed')) {
    // Handle upload failure
  } else {
    // Handle other errors
  }
}
```

## Testing

The system includes comprehensive test coverage:

- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end workflow testing
- **Performance Tests**: Optimization and CDN delivery testing

Run tests:
```bash
npm run test:run -- src/lib/services/__tests__/media-manager.test.ts
npm run test:run -- src/lib/services/__tests__/cdn-manager.test.ts
npm run test:run -- src/lib/database/__tests__/media-repository.test.ts
```

## Migration from WordPress

The media management system supports WordPress media migration:

```typescript
// This functionality will be implemented in task 6
const migrationResult = await wordPressMigrator.processMedia(wpMediaFiles);
```

## Security Considerations

1. **File Type Validation**: Only allowed MIME types are accepted
2. **Size Limits**: Configurable maximum file sizes
3. **Storage Security**: Supabase RLS policies protect media assets
4. **CDN Security**: Signed URLs for private content (when needed)

## Troubleshooting

### Common Issues

1. **Upload Failures**:
   - Check Supabase storage configuration
   - Verify file size limits
   - Ensure proper permissions

2. **Optimization Errors**:
   - Sharp library installation issues
   - Memory limits for large images
   - Format conversion failures

3. **CDN Issues**:
   - API key configuration
   - Cache purging permissions
   - URL generation problems

### Debug Mode

Enable debug logging:
```typescript
// Set environment variable
DEBUG=media-manager:*
```

## Contributing

When contributing to the media management system:

1. Add tests for new features
2. Update documentation
3. Follow TypeScript best practices
4. Consider performance implications
5. Test with various image formats and sizes
