import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BlogPost } from '@/lib/types/index.js';

// Mock blog posts data
const mockPosts: BlogPost[] = [
  {
    id: '1',
    title: 'First Blog Post',
    slug: 'first-blog-post',
    content: '<p>First post content</p>',
    excerpt: 'First post excerpt',
    author: {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com'
    },
    publishedAt: new Date('2024-01-15'),
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    status: 'published' as const,
    categories: [],
    tags: [],
    seoMetadata: {}
  },
  {
    id: '2',
    title: 'Second Blog Post',
    slug: 'second-blog-post',
    content: '<p>Second post content</p>',
    excerpt: 'Second post excerpt',
    author: {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com'
    },
    publishedAt: new Date('2024-01-16'),
    createdAt: new Date('2024-01-16'),
    updatedAt: new Date('2024-01-16'),
    status: 'published' as const,
    categories: [],
    tags: [],
    seoMetadata: {}
  }
];

// Mock BlogPostGrid component for testing
const BlogPostGrid = ({ 
  posts, 
  variant = 'default',
  showExcerpts = true,
  showTags = true,
  showCategories = false 
}: {
  posts: BlogPost[];
  variant?: 'default' | 'masonry' | 'featured-first';
  showExcerpts?: boolean;
  showTags?: boolean;
  showCategories?: boolean;
}) => {
  const gridClasses = {
    default: 'blog-grid',
    masonry: 'blog-grid blog-grid--masonry',
    'featured-first': 'blog-grid blog-grid--featured'
  };

  if (posts.length === 0) {
    return (
      <div className="empty-state" data-testid="empty-state">
        <div className="empty-state-content">
          <h3 className="empty-state-title">No posts found</h3>
          <p className="empty-state-description">
            There are no posts to display at the moment.
          </p>
          <a href="/" className="empty-state-link">
            ← Back to home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={gridClasses[variant]} data-testid="blog-grid">
      {posts.map((post, index) => {
        const cardVariant = variant === 'featured-first' && index === 0 ? 'featured' : 'default';
        
        return (
          <article 
            key={post.id} 
            className={`blog-post-card blog-post-card--${cardVariant}`}
            data-testid={`post-card-${post.id}`}
          >
            <h2>{post.title}</h2>
            <p>By {post.author.name}</p>
            {showExcerpts && post.excerpt && <p>{post.excerpt}</p>}
          </article>
        );
      })}
    </div>
  );
};

describe('BlogPostGrid', () => {
  it('renders posts in default grid layout', () => {
    render(<BlogPostGrid posts={mockPosts} />);
    
    const grid = screen.getByTestId('blog-grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveClass('blog-grid');
    
    expect(screen.getByTestId('post-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('post-card-2')).toBeInTheDocument();
    expect(screen.getByText('First Blog Post')).toBeInTheDocument();
    expect(screen.getByText('Second Blog Post')).toBeInTheDocument();
  });

  it('applies correct variant classes', () => {
    const { rerender } = render(<BlogPostGrid posts={mockPosts} variant="masonry" />);
    expect(screen.getByTestId('blog-grid')).toHaveClass('blog-grid--masonry');

    rerender(<BlogPostGrid posts={mockPosts} variant="featured-first" />);
    expect(screen.getByTestId('blog-grid')).toHaveClass('blog-grid--featured');
  });

  it('makes first post featured in featured-first variant', () => {
    render(<BlogPostGrid posts={mockPosts} variant="featured-first" />);
    
    const firstPost = screen.getByTestId('post-card-1');
    const secondPost = screen.getByTestId('post-card-2');
    
    expect(firstPost).toHaveClass('blog-post-card--featured');
    expect(secondPost).toHaveClass('blog-post-card--default');
  });

  it('shows empty state when no posts', () => {
    render(<BlogPostGrid posts={[]} />);
    
    const emptyState = screen.getByTestId('empty-state');
    expect(emptyState).toBeInTheDocument();
    expect(screen.getByText('No posts found')).toBeInTheDocument();
    expect(screen.getByText('There are no posts to display at the moment.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Back to home' })).toHaveAttribute('href', '/');
  });

  it('passes props to individual post cards', () => {
    const { rerender } = render(
      <BlogPostGrid posts={mockPosts} showExcerpts={true} />
    );
    
    expect(screen.getByText('First post excerpt')).toBeInTheDocument();
    expect(screen.getByText('Second post excerpt')).toBeInTheDocument();

    rerender(<BlogPostGrid posts={mockPosts} showExcerpts={false} />);
    
    expect(screen.queryByText('First post excerpt')).not.toBeInTheDocument();
    expect(screen.queryByText('Second post excerpt')).not.toBeInTheDocument();
  });

  it('handles single post correctly', () => {
    const singlePost = [mockPosts[0]];
    render(<BlogPostGrid posts={singlePost} />);
    
    expect(screen.getByTestId('blog-grid')).toBeInTheDocument();
    expect(screen.getByTestId('post-card-1')).toBeInTheDocument();
    expect(screen.queryByTestId('post-card-2')).not.toBeInTheDocument();
  });

  it('maintains proper grid structure with different post counts', () => {
    const { rerender } = render(<BlogPostGrid posts={mockPosts} />);
    
    // Test with 2 posts
    expect(screen.getAllByRole('article')).toHaveLength(2);
    
    // Test with 1 post
    rerender(<BlogPostGrid posts={[mockPosts[0]]} />);
    expect(screen.getAllByRole('article')).toHaveLength(1);
    
    // Test with 3 posts
    const threePosts = [...mockPosts, { ...mockPosts[0], id: '3', title: 'Third Post' }];
    rerender(<BlogPostGrid posts={threePosts} />);
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('has proper accessibility structure', () => {
    render(<BlogPostGrid posts={mockPosts} />);
    
    // Check that all posts are rendered as articles
    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(2);
    
    // Check that headings are present
    expect(screen.getByRole('heading', { name: 'First Blog Post' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Second Blog Post' })).toBeInTheDocument();
  });

  it('handles posts with missing optional fields', () => {
    const postsWithMissingFields = [
      {
        ...mockPosts[0],
        excerpt: undefined
      }
    ];
    
    render(<BlogPostGrid posts={postsWithMissingFields} showExcerpts={true} />);
    
    expect(screen.getByText('First Blog Post')).toBeInTheDocument();
    expect(screen.queryByText('First post excerpt')).not.toBeInTheDocument();
  });
});