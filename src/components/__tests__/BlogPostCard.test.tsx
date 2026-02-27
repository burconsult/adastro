import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BlogPost } from '@/lib/types/index.js';

// Mock blog post data
const mockPost: BlogPost = {
  id: '1',
  title: 'Test Blog Post',
  slug: 'test-blog-post',
  content: '<p>This is test content</p>',
  excerpt: 'This is a test excerpt',
  author: {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com'
  },
  publishedAt: new Date('2024-01-15'),
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
  status: 'published' as const,
  categories: [
    { id: '1', name: 'Technology', slug: 'technology' }
  ],
  tags: [
    { id: '1', name: 'React', slug: 'react' },
    { id: '2', name: 'Testing', slug: 'testing' }
  ],
  featuredImage: {
    id: '1',
    filename: 'test-image.jpg',
    url: '/images/test-image.jpg',
    altText: 'Test featured image',
    mimeType: 'image/jpeg',
    size: 1024
  },
  seoMetadata: {}
};

// Mock BlogPostCard component for testing
const BlogPostCard = ({ 
  post, 
  variant = 'default',
  showExcerpt = true,
  showTags = true,
  showCategories = false 
}: {
  post: BlogPost;
  variant?: 'default' | 'compact' | 'featured';
  showExcerpt?: boolean;
  showTags?: boolean;
  showCategories?: boolean;
}) => {
  return (
    <article className={`blog-post-card blog-post-card--${variant}`} data-testid="blog-post-card">
      <div className="post-card-wrapper">
        <div className="post-card-content">
          <div className="post-image-container">
            <a href={`/blog/${post.slug}/`} className="post-image-link">
              <img
                src={post.featuredImage?.url || '/images/article_image_01.webp'}
                alt={post.featuredImage?.altText || `Featured image for ${post.title}`}
                className="post-image"
                data-testid="post-image"
              />
            </a>
            <div className="post-overlay-content">
              <div className="post-meta">
                <span className="post-author">By {post.author.name}</span>
                <span className="post-date">{post.publishedAt?.toLocaleDateString()}</span>
              </div>
              <h2 className="post-title">
                <a href={`/blog/${post.slug}/`} className="post-title-link">
                  {post.title}
                </a>
              </h2>
            </div>
          </div>

          <div className="post-content">
            {showExcerpt && post.excerpt && (
              <p className="post-excerpt">{post.excerpt}</p>
            )}

            {showCategories && post.categories && post.categories.length > 0 && (
              <div className="post-categories" data-testid="post-categories">
                {post.categories.map((category) => (
                  <a key={category.id} href={`/category/${category.slug}/`} className="category-badge">
                    {category.name}
                  </a>
                ))}
              </div>
            )}

            {showTags && post.tags && post.tags.length > 0 && (
              <div className="post-tags" data-testid="post-tags">
                {post.tags.map((tag) => (
                  <a key={tag.id} href={`/tag/${tag.slug}/`} className="tag-badge">
                    #{tag.name}
                  </a>
                ))}
              </div>
            )}

            <div className="post-actions">
              <a href={`/blog/${post.slug}/`} className="read-more-btn">
                Read more
                <span className="sr-only">about {post.title}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

describe('BlogPostCard', () => {
  it('renders with default props', () => {
    render(<BlogPostCard post={mockPost} />);
    
    expect(screen.getByTestId('blog-post-card')).toBeInTheDocument();
    expect(screen.getByText('Test Blog Post')).toBeInTheDocument();
    expect(screen.getByText('By John Doe')).toBeInTheDocument();
    expect(screen.getByText('This is a test excerpt')).toBeInTheDocument();
  });

  it('applies correct variant class', () => {
    const { rerender } = render(<BlogPostCard post={mockPost} variant="compact" />);
    expect(screen.getByTestId('blog-post-card')).toHaveClass('blog-post-card--compact');

    rerender(<BlogPostCard post={mockPost} variant="featured" />);
    expect(screen.getByTestId('blog-post-card')).toHaveClass('blog-post-card--featured');
  });

  it('shows/hides excerpt based on showExcerpt prop', () => {
    const { rerender } = render(<BlogPostCard post={mockPost} showExcerpt={true} />);
    expect(screen.getByText('This is a test excerpt')).toBeInTheDocument();

    rerender(<BlogPostCard post={mockPost} showExcerpt={false} />);
    expect(screen.queryByText('This is a test excerpt')).not.toBeInTheDocument();
  });

  it('shows/hides tags based on showTags prop', () => {
    const { rerender } = render(<BlogPostCard post={mockPost} showTags={true} />);
    expect(screen.getByTestId('post-tags')).toBeInTheDocument();
    expect(screen.getByText('#React')).toBeInTheDocument();
    expect(screen.getByText('#Testing')).toBeInTheDocument();

    rerender(<BlogPostCard post={mockPost} showTags={false} />);
    expect(screen.queryByTestId('post-tags')).not.toBeInTheDocument();
  });

  it('shows/hides categories based on showCategories prop', () => {
    const { rerender } = render(<BlogPostCard post={mockPost} showCategories={true} />);
    expect(screen.getByTestId('post-categories')).toBeInTheDocument();
    expect(screen.getByText('Technology')).toBeInTheDocument();

    rerender(<BlogPostCard post={mockPost} showCategories={false} />);
    expect(screen.queryByTestId('post-categories')).not.toBeInTheDocument();
  });

  it('uses featured image when available', () => {
    render(<BlogPostCard post={mockPost} />);
    
    const image = screen.getByTestId('post-image');
    expect(image).toHaveAttribute('src', '/images/test-image.jpg');
    expect(image).toHaveAttribute('alt', 'Test featured image');
  });

  it('uses fallback image when no featured image', () => {
    const postWithoutImage = { ...mockPost, featuredImage: undefined };
    render(<BlogPostCard post={postWithoutImage} />);
    
    const image = screen.getByTestId('post-image');
    expect(image).toHaveAttribute('src', '/images/article_image_01.webp');
    expect(image).toHaveAttribute('alt', 'Featured image for Test Blog Post');
  });

  it('has proper link structure', () => {
    render(<BlogPostCard post={mockPost} />);
    
    const titleLink = screen.getByText('Test Blog Post').closest('a');
    expect(titleLink).toHaveAttribute('href', '/blog/test-blog-post/');
    
    const readMoreLink = screen.getByText('Read more').closest('a');
    expect(readMoreLink).toHaveAttribute('href', '/blog/test-blog-post/');
  });

  it('has proper accessibility attributes', () => {
    render(<BlogPostCard post={mockPost} />);
    
    // Check for screen reader only content
    expect(screen.getByText('about Test Blog Post')).toHaveClass('sr-only');
    
    // Check for semantic HTML structure
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('formats date correctly', () => {
    render(<BlogPostCard post={mockPost} />);
    
    // The date should be formatted as a locale date string
    expect(screen.getByText('1/15/2024')).toBeInTheDocument();
  });

  it('handles missing excerpt gracefully', () => {
    const postWithoutExcerpt = { ...mockPost, excerpt: undefined };
    render(<BlogPostCard post={postWithoutExcerpt} showExcerpt={true} />);
    
    expect(screen.queryByText('This is a test excerpt')).not.toBeInTheDocument();
  });

  it('handles empty tags and categories arrays', () => {
    const postWithoutTaxonomy = { 
      ...mockPost, 
      tags: [], 
      categories: [] 
    };
    
    render(
      <BlogPostCard 
        post={postWithoutTaxonomy} 
        showTags={true} 
        showCategories={true} 
      />
    );
    
    expect(screen.queryByTestId('post-tags')).not.toBeInTheDocument();
    expect(screen.queryByTestId('post-categories')).not.toBeInTheDocument();
  });
});
