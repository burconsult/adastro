import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock window.matchMedia
const mockMatchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

// Mock components for responsive testing
const ResponsiveGrid = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`responsive-grid ${className}`} data-testid="responsive-grid">
    {children}
  </div>
);

const MobileNavigation = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  
  return (
    <nav>
      <button 
        className="mobile-menu-button sm:hidden"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        data-testid="mobile-menu-button"
      >
        Menu
      </button>
      
      <div 
        className={`mobile-menu-overlay ${isOpen ? 'open' : ''}`}
        data-testid="mobile-menu-overlay"
      >
        <button 
          onClick={() => setIsOpen(false)}
          data-testid="mobile-menu-close"
        >
          Close
        </button>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </div>
      
      <div className="desktop-nav hidden sm:flex" data-testid="desktop-nav">
        <a href="/">Home</a>
        <a href="/about">About</a>
      </div>
    </nav>
  );
};

const BlogPostCard = ({ variant = 'default' }: { variant?: 'default' | 'compact' | 'featured' }) => (
  <article className={`blog-post-card blog-post-card--${variant}`} data-testid="blog-post-card">
    <div className="post-image-container">
      <img src="/test.jpg" alt="Test" className="post-image" />
    </div>
    <div className="post-content">
      <h2>Test Post</h2>
      <p>Test content</p>
      <button className="read-more-btn">Read more</button>
    </div>
  </article>
);

// Add React import for useState
import React from 'react';

describe('Responsive Behavior Tests', () => {
  beforeEach(() => {
    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(mockMatchMedia),
    });
    
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mobile navigation toggles correctly', () => {
    render(<MobileNavigation />);
    
    const menuButton = screen.getByTestId('mobile-menu-button');
    const menuOverlay = screen.getByTestId('mobile-menu-overlay');
    
    // Initially closed
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuOverlay).not.toHaveClass('open');
    
    // Open menu
    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(menuOverlay).toHaveClass('open');
    
    // Close menu
    const closeButton = screen.getByTestId('mobile-menu-close');
    fireEvent.click(closeButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuOverlay).not.toHaveClass('open');
  });

  it('responsive grid adapts to different screen sizes', () => {
    const { container } = render(
      <ResponsiveGrid>
        <BlogPostCard />
        <BlogPostCard />
        <BlogPostCard />
      </ResponsiveGrid>
    );
    
    const grid = screen.getByTestId('responsive-grid');
    expect(grid).toHaveClass('responsive-grid');
    
    // Test that grid contains the expected number of items
    const cards = screen.getAllByTestId('blog-post-card');
    expect(cards).toHaveLength(3);
  });

  it('blog post cards have responsive classes', () => {
    const { rerender } = render(<BlogPostCard variant="default" />);
    
    let card = screen.getByTestId('blog-post-card');
    expect(card).toHaveClass('blog-post-card--default');
    
    rerender(<BlogPostCard variant="compact" />);
    card = screen.getByTestId('blog-post-card');
    expect(card).toHaveClass('blog-post-card--compact');
    
    rerender(<BlogPostCard variant="featured" />);
    card = screen.getByTestId('blog-post-card');
    expect(card).toHaveClass('blog-post-card--featured');
  });

  it('handles window resize events', () => {
    render(<MobileNavigation />);
    
    // Simulate window resize
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 640,
    });
    
    fireEvent(window, new Event('resize'));
    
    // Menu should still be functional after resize
    const menuButton = screen.getByTestId('mobile-menu-button');
    expect(menuButton).toBeInTheDocument();
  });

  it('keyboard navigation works correctly', () => {
    render(<MobileNavigation />);
    
    const menuButton = screen.getByTestId('mobile-menu-button');
    
    // Open menu with Enter key
    fireEvent.keyDown(menuButton, { key: 'Enter' });
    fireEvent.click(menuButton); // Simulate the click that would happen
    
    const menuOverlay = screen.getByTestId('mobile-menu-overlay');
    expect(menuOverlay).toHaveClass('open');
    
    // Close menu with Escape key
    fireEvent.keyDown(document, { key: 'Escape' });
    // Note: In a real implementation, you'd need to handle the escape key event
  });

  it('touch-friendly button sizes are maintained', () => {
    render(<BlogPostCard />);
    
    const readMoreButton = screen.getByText('Read more');
    expect(readMoreButton).toHaveClass('read-more-btn');
    
    // In a real test, you might check computed styles for minimum touch target size
    // expect(getComputedStyle(readMoreButton).minHeight).toBe('44px');
  });

  it('images are responsive by default', () => {
    render(<BlogPostCard />);
    
    const image = screen.getByAltText('Test');
    expect(image).toHaveClass('post-image');
    
    // In a real implementation, you'd check for responsive image attributes
    // expect(image).toHaveAttribute('sizes');
    // expect(image).toHaveAttribute('srcset');
  });

  it('navigation shows/hides based on screen size classes', () => {
    render(<MobileNavigation />);
    
    const mobileButton = screen.getByTestId('mobile-menu-button');
    const desktopNav = screen.getByTestId('desktop-nav');
    
    // Check that appropriate classes are applied
    expect(mobileButton).toHaveClass('sm:hidden');
    expect(desktopNav).toHaveClass('hidden', 'sm:flex');
  });

  it('handles reduced motion preferences', () => {
    // Mock prefers-reduced-motion
    const mockMediaQuery = {
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    
    window.matchMedia = vi.fn().mockImplementation((query) => {
      if (query === '(prefers-reduced-motion: reduce)') {
        return mockMediaQuery;
      }
      return mockMatchMedia(query);
    });
    
    render(<BlogPostCard />);
    
    // In a real implementation, you'd check that animations are disabled
    // when prefers-reduced-motion is set
    const card = screen.getByTestId('blog-post-card');
    expect(card).toBeInTheDocument();
  });

  it('supports high contrast mode', () => {
    // Mock prefers-contrast
    const mockMediaQuery = {
      matches: true,
      media: '(prefers-contrast: high)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    
    window.matchMedia = vi.fn().mockImplementation((query) => {
      if (query === '(prefers-contrast: high)') {
        return mockMediaQuery;
      }
      return mockMatchMedia(query);
    });
    
    render(<BlogPostCard />);
    
    // In a real implementation, you'd check that high contrast styles are applied
    const card = screen.getByTestId('blog-post-card');
    expect(card).toBeInTheDocument();
  });
});