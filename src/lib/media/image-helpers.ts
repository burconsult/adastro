import type { MediaAsset } from '../types/index.js';
import { cdnManager } from '../services/cdn-manager.js';

export const MEDIA_BREAKPOINTS = [320, 640, 960, 1280, 1600];

export interface ResponsiveSourceSet {
  format: 'avif' | 'webp' | 'jpeg';
  srcset: string;
}

const FORMAT_LIST: ResponsiveSourceSet['format'][] = ['avif', 'webp', 'jpeg'];

const buildTransformOptions = (
  width: number,
  format?: ResponsiveSourceSet['format']
) => {
  const options: {
    width: number;
    quality: number;
    format?: ResponsiveSourceSet['format'];
  } = {
    width,
    quality: width >= 1280 ? 82 : 88
  };

  if (format && cdnManager.supportsExplicitFormatSelection()) {
    options.format = format;
  }

  return options;
};

export function buildSourceSets(asset: MediaAsset, breakpoints: number[] = MEDIA_BREAKPOINTS): ResponsiveSourceSet[] {
  if (!cdnManager.supportsExplicitFormatSelection()) {
    return [];
  }

  return FORMAT_LIST.map((format) => ({
    format,
    srcset: breakpoints
      .map((width) => {
        const optimized = cdnManager.generateOptimizedUrl(asset, buildTransformOptions(width, format));
        return `${optimized} ${width}w`;
      })
      .join(', ')
  }));
}

export function buildImgSrcSet(asset: MediaAsset, breakpoints: number[] = MEDIA_BREAKPOINTS): string {
  if (!cdnManager.supportsUrlTransforms()) {
    return '';
  }

  return breakpoints
    .map((width) => {
      const optimized = cdnManager.generateOptimizedUrl(asset, buildTransformOptions(width, 'jpeg'));
      return `${optimized} ${width}w`;
    })
    .join(', ');
}

export function buildFallbackSrc(asset: MediaAsset, width = 960): string {
  return cdnManager.generateOptimizedUrl(asset, buildTransformOptions(width, 'jpeg'));
}

export function approximateSizes(breakpoints: number[] = MEDIA_BREAKPOINTS): string {
  if (breakpoints.length === 0) {
    return '100vw';
  }
  const max = Math.max(...breakpoints);
  return `(max-width: ${max}px) 100vw, ${max}px`;
}

export function assetFromUrl(url: string, altText?: string): MediaAsset {
  return {
    id: `external-${url}`,
    filename: url.split('/').pop() || 'image',
    url,
    storagePath: url,
    altText,
    mimeType: 'image/jpeg',
    fileSize: 0,
    createdAt: new Date()
  } as MediaAsset;
}
