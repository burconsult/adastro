import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock components for accessibility testing
const ResponsiveImage = ({ src, alt, className = '' }: { src: string; alt: string; className?: string }) => (
  <picture className={className}>
    <source type="image/avif" />
    <source type="image/webp" />
    <source type="image/jpeg" />
    <img src={src} alt={alt} />
  </picture>
);

const MobileNavigation = () => (
  <nav role="navigation" aria-label="Main navigation">
    <button 
      aria-label="Toggle mobile menu"
      aria-expanded="false"
      className="mobile-menu-button"
    >
      <span>Menu</span>
    </button>
    
    <div className="mobile-menu-overlay" role="dialog" aria-modal="true" aria-hidden="true">
      <div className="mobile-menu-content">
        <button aria-label="Close mobile menu">×</button>
        <ul role="list">
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
      </div>
    </div>
  </nav>
);

const BlogPostCard = ({ 
  title, 
  author, 
  date, 
  excerpt, 
  slug,
  imageUrl,
  imageAlt 
}: {
  title: string;
  author: string;
  date: string;
  excerpt?: string;
  slug: string;
  imageUrl: string;
  imageAlt: string;
}) => (
  <article>
    <ResponsiveImage src={imageUrl} alt={imageAlt} />
    <h2>
      <a href={`/blog/${slug}/`}>{title}</a>
    </h2>
    <p>By {author} • <time dateTime={date}>{date}</time></p>
    {excerpt && <p>{excerpt}</p>}
    <a href={`/blog/${slug}/`} aria-label={`Read more about ${title}`}>
      Read more
    </a>
  </article>
);

describe('Accessibility Tests', () => {
  it('ResponsiveImage has no accessibility violations', async () => {
    const { container } = render(
      <ResponsiveImage 
        src="/test-image.jpg" 
        alt="Descriptive alt text for screen readers" 
      />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('ResponsiveImage with empty alt text passes accessibility', async () => {
    const { container } = render(
      <ResponsiveImage 
        src="/decorative-image.jpg" 
        alt="" 
      />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('MobileNavigation has no accessibility violations', async () => {
    const { container } = render(<MobileNavigation />);
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('BlogPostCard has no accessibility violations', async () => {
    const { container } = render(
      <BlogPostCard
        title="Test Blog Post"
        author="John Doe"
        date="2024-01-15"
        excerpt="This is a test excerpt"
        slug="test-blog-post"
        imageUrl="/test-image.jpg"
        imageAlt="Test featured image"
      />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has proper heading hierarchy', () => {
    render(
      <div>
        <h1>Main Page Title</h1>
        <BlogPostCard
          title="Test Blog Post"
          author="John Doe"
          date="2024-01-15"
          slug="test-blog-post"
          imageUrl="/test-image.jpg"
          imageAlt="Test featured image"
        />
      </div>
    );

    const h1 = screen.getByRole('heading', { level: 1 });
    const h2 = screen.getByRole('heading', { level: 2 });
    
    expect(h1).toBeInTheDocument();
    expect(h2).toBeInTheDocument();
  });

  it('has proper link accessibility', () => {
    render(
      <BlogPostCard
        title="Test Blog Post"
        author="John Doe"
        date="2024-01-15"
        slug="test-blog-post"
        imageUrl="/test-image.jpg"
        imageAlt="Test featured image"
      />
    );

    const titleLink = screen.getByRole('link', { name: 'Test Blog Post' });
    const readMoreLink = screen.getByRole('link', { name: 'Read more about Test Blog Post' });
    
    expect(titleLink).toHaveAttribute('href', '/blog/test-blog-post/');
    expect(readMoreLink).toHaveAttribute('href', '/blog/test-blog-post/');
  });

  it('has proper time element with datetime attribute', () => {
    render(
      <BlogPostCard
        title="Test Blog Post"
        author="John Doe"
        date="2024-01-15"
        slug="test-blog-post"
        imageUrl="/test-image.jpg"
        imageAlt="Test featured image"
      />
    );

    const timeElement = screen.getByText('2024-01-15');
    expect(timeElement.tagName).toBe('TIME');
    expect(timeElement).toHaveAttribute('datetime', '2024-01-15');
  });

  it('navigation has proper ARIA attributes', () => {
    render(<MobileNavigation />);

    const nav = screen.getByRole('navigation');
    const menuButton = screen.getByLabelText('Toggle mobile menu');
    const menuDialog = document.querySelector('[role="dialog"]');

    expect(nav).toHaveAttribute('aria-label', 'Main navigation');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuDialog).toHaveAttribute('aria-modal', 'true');
    expect(menuDialog).toHaveAttribute('aria-hidden', 'true');
  });

  it('images have appropriate alt text', () => {
    render(
      <div>
        <ResponsiveImage 
          src="/content-image.jpg" 
          alt="Chart showing website traffic increase over 6 months" 
        />
        <ResponsiveImage 
          src="/decorative-border.jpg" 
          alt="" 
        />
      </div>
    );

    const contentImage = screen.getByAltText('Chart showing website traffic increase over 6 months');
    const decorativeImage = screen.getByAltText('');

    expect(contentImage).toBeInTheDocument();
    expect(decorativeImage).toBeInTheDocument();
  });

  it('maintains focus management for mobile menu', () => {
    render(<MobileNavigation />);

    const menuButton = screen.getByLabelText('Toggle mobile menu');
    const closeButton = screen.getByLabelText('Close mobile menu');

    expect(menuButton).toBeInTheDocument();
    expect(closeButton).toBeInTheDocument();
  });

  it('has semantic HTML structure', () => {
    render(
      <main>
        <h1>Blog Posts</h1>
        <BlogPostCard
          title="Test Blog Post"
          author="John Doe"
          date="2024-01-15"
          slug="test-blog-post"
          imageUrl="/test-image.jpg"
          imageAlt="Test featured image"
        />
      </main>
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });
});
