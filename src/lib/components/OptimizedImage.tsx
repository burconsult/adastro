import React from 'react';
import { cdnManager } from '../services/cdn-manager.js';
import { buildFallbackSrc, buildSourceSets } from '../media/image-helpers.js';
import type { MediaAsset } from '../types/index.js';

interface OptimizedImageProps {
  asset: MediaAsset;
  alt?: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
  priority?: boolean;
  style?: React.CSSProperties;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  asset,
  alt,
  className = '',
  loading = 'lazy',
  sizes = '100vw',
  priority = false,
  style
}) => {
  const altText = alt || asset.altText || asset.filename;

  const sources = buildSourceSets(asset);
  const fallbackSrc = buildFallbackSrc(asset);

  // Generate preload links for critical images
  const preloadLinks = priority ? cdnManager.generatePreloadLinks([asset]) : [];

  return (
    <>
      {/* Preload links for critical images */}
      {priority && preloadLinks.map((link, index) => (
        <link
          key={index}
          rel="preload"
          as="image"
          href={link.match(/href="([^"]+)"/)?.[1]}
          type={link.match(/type="([^"]+)"/)?.[1]}
        />
      ))}

      <picture className={className} style={style}>
        {/* AVIF source */}
        {sources.map((source) => (
          <source
            key={source.format}
            type={`image/${source.format}`}
            srcSet={source.srcset}
            sizes={sizes}
          />
        ))}
        
        {/* Fallback img element */}
        <img
          src={fallbackSrc}
          alt={altText}
          loading={loading}
          decoding="async"
          sizes={sizes}
          style={{
            width: '100%',
            height: 'auto',
            ...style
          }}
          onError={(e) => {
            // Fallback to original URL if CDN fails
            const target = e.target as HTMLImageElement;
            if (target.src !== asset.url) {
              target.src = asset.url;
            }
          }}
        />
      </picture>
    </>
  );
};

// Utility component for hero/featured images
export const HeroImage: React.FC<Omit<OptimizedImageProps, 'loading' | 'priority'>> = (props) => (
  <OptimizedImage
    {...props}
    loading="eager"
    priority={true}
    sizes="100vw"
  />
);

// Utility component for thumbnail images
export const ThumbnailImage: React.FC<Omit<OptimizedImageProps, 'sizes'>> = (props) => (
  <OptimizedImage
    {...props}
    sizes="(max-width: 768px) 100px, 150px"
  />
);

// Utility component for content images
export const ContentImage: React.FC<OptimizedImageProps> = (props) => (
  <OptimizedImage
    {...props}
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
  />
);

export default OptimizedImage;
