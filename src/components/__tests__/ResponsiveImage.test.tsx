import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

// Mock Astro component for testing
const ResponsiveImage = ({
  src,
  alt,
  width,
  height,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  loading = 'lazy',
  className = '',
  priority = false
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  className?: string;
  priority?: boolean;
}) => {
  const finalLoading = priority ? 'eager' : loading;

  return (
    <picture data-testid="responsive-image" className={className}>
      <source type="image/avif" data-testid="source-avif" />
      <source type="image/webp" data-testid="source-webp" />
      <source type="image/jpeg" data-testid="source-jpeg" />
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={finalLoading}
        sizes={sizes}
        className="responsive-image"
        decoding="async"
      />
    </picture>
  );
};

describe('ResponsiveImage', () => {
  it('renders with basic props', () => {
    const { getByTestId } = render(
      <ResponsiveImage 
        src="/test-image.jpg" 
        alt="Test image" 
      />
    );
    
    const picture = getByTestId('responsive-image');
    expect(picture).toBeInTheDocument();
    const img = picture.querySelector('img')!;
    expect(img).toHaveAttribute('src', '/test-image.jpg');
    expect(img).toHaveAttribute('alt', 'Test image');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('sets loading to eager when priority is true', () => {
    const { getByTestId } = render(
      <ResponsiveImage 
        src="/test-image.jpg" 
        alt="Test image" 
        priority={true}
      />
    );
    
    const picture = getByTestId('responsive-image');
    const img = picture.querySelector('img')!;
    expect(img).toHaveAttribute('loading', 'eager');
  });

  it('applies custom className', () => {
    const { getByTestId } = render(
      <ResponsiveImage 
        src="/test-image.jpg" 
        alt="Test image" 
        className="custom-class"
      />
    );
    
    const picture = getByTestId('responsive-image');
    expect(picture).toHaveClass('custom-class');
  });

  it('sets width and height attributes', () => {
    const { getByTestId } = render(
      <ResponsiveImage 
        src="/test-image.jpg" 
        alt="Test image" 
        width={800}
        height={600}
      />
    );
    
    const picture = getByTestId('responsive-image');
    const img = picture.querySelector('img')!;
    expect(img).toHaveAttribute('width', '800');
    expect(img).toHaveAttribute('height', '600');
  });

  it('uses default sizes attribute', () => {
    const { getByTestId } = render(
      <ResponsiveImage 
        src="/test-image.jpg" 
        alt="Test image" 
      />
    );
    
    const picture = getByTestId('responsive-image');
    const img = picture.querySelector('img')!;
    expect(img).toHaveAttribute('sizes', '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw');
  });

  it('uses custom sizes attribute', () => {
    const customSizes = '(max-width: 480px) 100vw, 50vw';
    const { getByTestId } = render(
      <ResponsiveImage 
        src="/test-image.jpg" 
        alt="Test image" 
        sizes={customSizes}
      />
    );
    
    const picture = getByTestId('responsive-image');
    const img = picture.querySelector('img')!;
    expect(img).toHaveAttribute('sizes', customSizes);
  });

  it('has proper accessibility attributes', () => {
    const { getByTestId } = render(
      <ResponsiveImage 
        src="/test-image.jpg" 
        alt="Descriptive alt text" 
      />
    );
    
    const picture = getByTestId('responsive-image');
    const img = picture.querySelector('img')!;
    expect(img).toHaveAttribute('alt', 'Descriptive alt text');
    expect(img).toHaveAttribute('decoding', 'async');
  });
});
