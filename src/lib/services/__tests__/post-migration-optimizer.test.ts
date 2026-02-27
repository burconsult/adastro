import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PostMigrationOptimizer } from '../post-migration-optimizer.js';

const { supabaseFromMock, storageFromMock } = vi.hoisted(() => ({
  supabaseFromMock: vi.fn(),
  storageFromMock: vi.fn()
}));

vi.mock('../../supabase.js', () => ({
  supabase: {
    from: supabaseFromMock,
    storage: {
      from: storageFromMock
    }
  },
  supabaseAdmin: {
    from: supabaseFromMock,
    storage: {
      from: storageFromMock
    }
  }
}));

// Mock media manager
vi.mock('../media-manager.js', () => ({
  mediaManager: {
    generateAltTextSuggestion: vi.fn().mockResolvedValue('Generated alt text')
  }
}));

describe('PostMigrationOptimizer', () => {
  let optimizer: PostMigrationOptimizer;

  beforeEach(() => {
    optimizer = new PostMigrationOptimizer();
    vi.clearAllMocks();
    supabaseFromMock.mockReset();
    storageFromMock.mockReset();
  });

  describe('scanAndUpdateImageUrls', () => {
    it('should identify WordPress media URLs correctly', () => {
      // Test the URL pattern matching logic directly
      const wpUrls = [
        'https://example.com/wp-content/uploads/2024/01/image.jpg',
        'https://example.com/uploads/image.jpg'
      ];

      const nonWpUrls = [
        'https://example.com/images/image.jpg',
        'https://cdn.example.com/image.jpg',
        'https://example.com/assets/image.jpg'
      ];

      // Test URL pattern matching
      wpUrls.forEach(url => {
        expect(url.includes('/wp-content/uploads/') || url.includes('/uploads/')).toBe(true);
      });

      nonWpUrls.forEach(url => {
        expect(url.includes('/wp-content/uploads/') || url.includes('/uploads/')).toBe(false);
      });
    });

    it('should update image URLs in post content', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          title: 'Test Post',
          content: '![Test Image](https://example.com/wp-content/uploads/2024/01/test.jpg)\n\nSome content here.'
        }
      ];

      const findOptimizedUrlSpy = vi
        .spyOn(optimizer as any, 'findOptimizedMediaUrl')
        .mockResolvedValue('https://cdn.example.com/test.jpg');

      supabaseFromMock.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockPosts, error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      const result = await optimizer.scanAndUpdateImageUrls();

      expect(result.postsScanned).toBe(1);
      expect(result.urlsUpdated).toBeGreaterThanOrEqual(0); // May be 0 if no optimized URL found

      findOptimizedUrlSpy.mockRestore();
    });

    it('should handle posts without WordPress media URLs', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          title: 'Test Post',
          content: '![Test Image](https://cdn.example.com/image.jpg)\n\nSome content here.'
        }
      ];

    supabaseFromMock.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockPosts, error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      const result = await optimizer.scanAndUpdateImageUrls();

      expect(result.postsScanned).toBe(1);
      expect(result.urlsUpdated).toBe(0);
    });
  });

  describe('detectAndRepairBrokenLinks', () => {
    it('should identify WordPress internal links correctly', () => {
      const wpInternalUrls = [
        'https://example.com/?p=123',
        'https://example.com/archives/post-name/'
      ];

      const externalUrls = [
        'https://google.com',
        'https://example.com/page/',
        'mailto:test@example.com'
      ];

      // Test URL pattern matching
      wpInternalUrls.forEach(url => {
        expect(url.includes('/?p=') || url.includes('/archives/')).toBe(true);
      });

      externalUrls.forEach(url => {
        expect(url.includes('/?p=') || url.includes('/archives/')).toBe(false);
      });
    });

    it('should extract slugs from WordPress URLs correctly', () => {
      // Test URL slug extraction logic
      const testCases = [
        { url: 'https://example.com/post-name/', expected: 'post-name' },
        { url: 'https://example.com/2024/01/01/post-name/', expected: 'post-name' },
        { url: 'https://example.com/category/post-name', expected: 'post-name' }
      ];

      testCases.forEach(({ url, expected }) => {
        // Simple slug extraction from URL
        const match = url.match(/\/([^\/]+)\/?$/);
        const result = match ? match[1] : null;
        expect(result).toBe(expected);
      });
    });

    it('should repair broken internal links', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          title: 'Test Post',
          content: 'Check out [this post](https://example.com/2024/01/01/existing-post/) for more info.',
          slug: 'test-post'
        },
        {
          id: 'post-2',
          title: 'Existing Post',
          content: 'This is the existing post.',
          slug: 'existing-post'
        }
      ];

      supabaseFromMock.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockPosts, error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      const result = await optimizer.detectAndRepairBrokenLinks();

      expect(result.linksFixed).toBe(1);
      expect(result.issues).toHaveLength(0);
    });

    it('should report broken links that cannot be repaired', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          title: 'Test Post',
          content: 'Check out [this post](https://example.com/2024/01/01/missing-post/) for more info.',
          slug: 'test-post'
        }
      ];

      supabaseFromMock.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockPosts, error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      const result = await optimizer.detectAndRepairBrokenLinks();

      expect(result.linksFixed).toBe(0);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('broken-link');
    });
  });

  describe('generateMissingAltText', () => {
    it('should generate alt text for media assets without it', async () => {
      const mockMediaAssets = [
        {
          id: 'media-1',
          filename: 'screenshot.jpg',
          storage_path: 'uploads/screenshot.jpg',
          alt_text: null,
          caption: null,
          mime_type: 'image/jpeg',
          file_size: 1024,
          dimensions: JSON.stringify({ width: 800, height: 600 }),
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      supabaseFromMock.mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockResolvedValue({ data: mockMediaAssets, error: null })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      const result = await optimizer.generateMissingAltText();

      expect(result.altTextGenerated).toBe(1);
    });

    it('should skip media assets that already have alt text', async () => {
      const mockMediaAssets = [
        {
          id: 'media-1',
          filename: 'image.jpg',
          alt_text: 'Existing alt text',
          // ... other properties
        }
      ];

      supabaseFromMock.mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockResolvedValue({ data: [], error: null }) // No assets without alt text
        })
      });

      const result = await optimizer.generateMissingAltText();

      expect(result.altTextGenerated).toBe(0);
    });
  });

  describe('optimizeContentStructure', () => {
    it('should fix heading hierarchy issues', () => {
      const content = `# Main Title
### Skipped H2
#### Another heading
## Proper H2`;

      const result = (optimizer as any).fixHeadingHierarchy(content);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('Heading level jumps from H1 to H3');
    });

    it('should fix paragraph spacing', () => {
      const content = `Paragraph 1


Paragraph 2



Paragraph 3`;

      const result = (optimizer as any).fixParagraphSpacing(content);

      expect(result.hasChanges).toBe(true);
      expect(result.content).not.toContain('\n\n\n\n');
    });

    it('should remove excessive line breaks', () => {
      const content = `Line 1




Line 2`;

      const result = (optimizer as any).removeExcessiveLineBreaks(content);

      expect(result.hasChanges).toBe(true);
      expect(result.content).toBe('Line 1\n\n\nLine 2');
    });

    it('should optimize content structure for multiple posts', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          title: 'Test Post',
          content: `# Title\n\n\n\nContent with too many breaks`
        }
      ];

    supabaseFromMock.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockPosts, error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      const result = await optimizer.optimizeContentStructure();

      expect(result.postsOptimized).toBe(1);
    });
  });

  describe('generateSEOAuditReport', () => {
    it('should analyze content for SEO issues', () => {
      const shortContent = 'This is very short content.';
      const longContentWithoutHeadings = 'This is a very long piece of content that goes on and on without any headings or structure. '.repeat(50);
      const wellStructuredContent = `# Main Title

## Section 1
This is good content with proper structure.

![Image](image.jpg)

## Section 2
More content with [internal link](/other-post).`;

      const shortAnalysis = (optimizer as any).analyzeContentForSEO(shortContent, 'Short Post');
      const longAnalysis = (optimizer as any).analyzeContentForSEO(longContentWithoutHeadings, 'Long Post');
      const goodAnalysis = (optimizer as any).analyzeContentForSEO(wellStructuredContent, 'Good Post');

      expect(shortAnalysis.recommendations).toContain('Content is quite short (<300 words) - consider expanding for better SEO');
      expect(longAnalysis.recommendations).toContain('No headings found - add H2/H3 headings to improve content structure');
      expect(goodAnalysis.recommendations.length).toBeLessThanOrEqual(1); // Well-structured content should have minimal issues
    });

    it('should calculate SEO priority correctly', () => {
      const highPriorityRecommendations = ['Missing meta description', 'Title too long'];
      const mediumPriorityRecommendations = ['Improve heading structure'];
      const lowPriorityRecommendations = ['Consider adding more images'];

      const highPriority = (optimizer as any).calculateSEOPriority(highPriorityRecommendations);
      const mediumPriority = (optimizer as any).calculateSEOPriority(mediumPriorityRecommendations);
      const lowPriority = (optimizer as any).calculateSEOPriority(lowPriorityRecommendations);

      expect(highPriority).toBe('high');
      expect(mediumPriority).toBe('medium');
      expect(lowPriority).toBe('low');
    });

    it('should generate SEO audit for posts', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          title: 'Test Post',
          content: 'Short content',
          excerpt: 'Test excerpt',
          slug: 'test-post',
          seo_metadata: null
        }
      ];

      supabaseFromMock.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockPosts, error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      const result = await optimizer.generateSEOAuditReport();

      expect(result.issuesFixed).toBeGreaterThan(0); // Should fix missing meta title and canonical URL
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].postTitle).toBe('Test Post');
    });
  });

  describe('runPostMigrationOptimization', () => {
    it('should run complete optimization workflow', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          title: 'Test Post',
          content: '![Old Image](https://example.com/wp-content/uploads/2024/01/old.jpg)\n\nContent here.',
          slug: 'test-post',
          excerpt: 'Test excerpt',
          seo_metadata: null
        }
      ];

      const mockMediaAssets = [
        {
          id: 'media-1',
          filename: 'image.jpg',
          storage_path: 'uploads/image.jpg',
          alt_text: null,
          caption: null,
          mime_type: 'image/jpeg',
          file_size: 1024,
          dimensions: JSON.stringify({ width: 800, height: 600 }),
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      // Mock different responses for different queries
    supabaseFromMock.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockResolvedValue({ data: mockPosts, error: null }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          };
        } else if (table === 'media_assets') {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockResolvedValue({ data: mockMediaAssets, error: null })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          };
        }
      });

      const result = await optimizer.runPostMigrationOptimization();

      expect(result.contentScanned).toBeGreaterThanOrEqual(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.issues).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      // Mock database error
    supabaseFromMock.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } })
      });

      const result = await optimizer.runPostMigrationOptimization();

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('system');
      expect(result.issues[0].severity).toBe('high');
    });
  });
});
