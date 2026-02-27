import { describe, it, expect, vi } from 'vitest';
import { AuthorRepository } from '../repositories/author-repository.js';
import { CategoryRepository } from '../repositories/category-repository.js';
import { TagRepository } from '../repositories/tag-repository.js';
import { PostRepository } from '../repositories/post-repository.js';

// Mock the Supabase client
vi.mock('../../supabase.js', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
  },
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
  },
}));

describe('Repository Mapping Functions', () => {
  describe('AuthorRepository', () => {
    let repo: AuthorRepository;

    beforeEach(() => {
      repo = new AuthorRepository(true);
    });

    it('should map database row to Author model', () => {
      const dbRow = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        bio: 'Author bio',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const author = repo.mapFromDatabase(dbRow);

      expect(author.id).toBe('123');
      expect(author.name).toBe('John Doe');
      expect(author.email).toBe('john@example.com');
      expect(author.bio).toBe('Author bio');
      expect(author.avatar?.url).toBe('https://example.com/avatar.jpg');
      expect(author.createdAt).toBeInstanceOf(Date);
      expect(author.updatedAt).toBeInstanceOf(Date);
    });

    it('should map Author model to database format', () => {
      const authorData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        bio: 'Jane bio',
        avatarUrl: 'https://example.com/jane.jpg',
      };

      const dbData = repo.mapToDatabase(authorData);

      expect(dbData.name).toBe('Jane Doe');
      expect(dbData.email).toBe('jane@example.com');
      expect(dbData.bio).toBe('Jane bio');
      expect(dbData.avatar_url).toBe('https://example.com/jane.jpg');
    });

    it('should handle null values in mapping', () => {
      const dbRow = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        bio: null,
        avatar_url: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const author = repo.mapFromDatabase(dbRow);

      expect(author.bio).toBeUndefined();
      expect(author.avatar).toBeUndefined();
    });
  });

  describe('CategoryRepository', () => {
    let repo: CategoryRepository;

    beforeEach(() => {
      repo = new CategoryRepository(true);
    });

    it('should map database row to Category model', () => {
      const dbRow = {
        id: '123',
        name: 'Technology',
        slug: 'technology',
        description: 'Tech posts',
        parent_id: '456',
        created_at: '2023-01-01T00:00:00Z',
      };

      const category = repo.mapFromDatabase(dbRow);

      expect(category.id).toBe('123');
      expect(category.name).toBe('Technology');
      expect(category.slug).toBe('technology');
      expect(category.description).toBe('Tech posts');
      expect(category.parentId).toBe('456');
      expect(category.createdAt).toBeInstanceOf(Date);
    });

    it('should map Category model to database format', () => {
      const categoryData = {
        name: 'Science',
        slug: 'science',
        description: 'Science posts',
        parentId: '789',
      };

      const dbData = repo.mapToDatabase(categoryData);

      expect(dbData.name).toBe('Science');
      expect(dbData.slug).toBe('science');
      expect(dbData.description).toBe('Science posts');
      expect(dbData.parent_id).toBe('789');
    });
  });

  describe('TagRepository', () => {
    let repo: TagRepository;

    beforeEach(() => {
      repo = new TagRepository(true);
    });

    it('should map database row to Tag model', () => {
      const dbRow = {
        id: '123',
        name: 'JavaScript',
        slug: 'javascript',
        created_at: '2023-01-01T00:00:00Z',
      };

      const tag = repo.mapFromDatabase(dbRow);

      expect(tag.id).toBe('123');
      expect(tag.name).toBe('JavaScript');
      expect(tag.slug).toBe('javascript');
      expect(tag.createdAt).toBeInstanceOf(Date);
    });

    it('should map Tag model to database format', () => {
      const tagData = {
        name: 'TypeScript',
        slug: 'typescript',
      };

      const dbData = repo.mapToDatabase(tagData);

      expect(dbData.name).toBe('TypeScript');
      expect(dbData.slug).toBe('typescript');
    });

    it('should generate slug from name', () => {
      const repo = new TagRepository(true);
      
      // Access the private method through any casting for testing
      const generateSlug = (repo as any).generateSlug.bind(repo);
      
      expect(generateSlug('JavaScript Programming')).toBe('javascript-programming');
      expect(generateSlug('C++ & Python!')).toBe('c-python');
      expect(generateSlug('  React.js  ')).toBe('reactjs');
    });
  });

  describe('PostRepository', () => {
    let repo: PostRepository;

    beforeEach(() => {
      repo = new PostRepository(true);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should map database row to Post model', () => {
      const dbRow = {
        id: '123',
        title: 'Test Post',
        slug: 'test-post',
        content: 'Post content',
        blocks: [],
        excerpt: 'Post excerpt',
        author_id: '456',
        status: 'published' as const,
        published_at: '2023-01-01T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        seo_metadata: { title: 'SEO Title' },
        custom_fields: { featured: true },
      };

      const post = repo.mapFromDatabase(dbRow);

      expect(post.id).toBe('123');
      expect(post.title).toBe('Test Post');
      expect(post.slug).toBe('test-post');
      expect(post.content).toBe('Post content');
      expect(post.blocks).toEqual([]);
      expect(post.excerpt).toBe('Post excerpt');
      expect(post.author.id).toBe('456');
      expect(post.status).toBe('published');
      expect(post.publishedAt).toBeInstanceOf(Date);
      expect(post.createdAt).toBeInstanceOf(Date);
      expect(post.updatedAt).toBeInstanceOf(Date);
      expect(post.seoMetadata).toEqual({ title: 'SEO Title' });
      expect(post.customFields).toEqual({ featured: true });
      expect(post.featuredImageId).toBeUndefined();
    });

    it('should map Post model to database format', () => {
      const postData = {
        title: 'New Post',
        slug: 'new-post',
        content: 'New content',
        blocks: [],
        excerpt: 'New excerpt',
        authorId: '789',
        status: 'draft' as const,
        publishedAt: new Date('2023-01-01'),
        seoMetadata: { description: 'SEO desc' },
        customFields: { priority: 'high' },
      };

      const dbData = repo.mapToDatabase(postData);

      expect(dbData.title).toBe('New Post');
      expect(dbData.slug).toBe('new-post');
      expect(dbData.content).toBe('New content');
      expect(dbData.blocks).toEqual([]);
      expect(dbData.excerpt).toBe('New excerpt');
      expect(dbData.author_id).toBe('789');
      expect(dbData.status).toBe('draft');
      expect(dbData.published_at).toBe('2023-01-01T00:00:00.000Z');
      expect(dbData.seo_metadata).toEqual({ description: 'SEO desc' });
      expect(dbData.custom_fields).toEqual({ priority: 'high' });
    });

    it('allows keeping the same slug when updating a post', async () => {
      const slug = 'existing-slug';
      vi.spyOn(repo, 'findBySlug').mockResolvedValue({ id: 'post-123' } as any);

      (repo as any).currentUpdatePostId = 'post-123';
      await expect(repo.validateUpdate({ slug })).resolves.not.toThrow();
      (repo as any).currentUpdatePostId = null;
    });

    it('throws when updating to a slug used by another post', async () => {
      const slug = 'existing-slug';
      vi.spyOn(repo, 'findBySlug').mockResolvedValue({ id: 'different-post' } as any);

      (repo as any).currentUpdatePostId = 'post-123';
      await expect(repo.validateUpdate({ slug })).rejects.toThrow('Post with this slug already exists');
      (repo as any).currentUpdatePostId = null;
    });

    it('populates featured image when present', async () => {
      const post = repo.mapFromDatabase({
        id: 'post-1',
        title: 'Test',
        slug: 'test',
        content: 'Content',
        excerpt: null,
        author_id: 'author-1',
        status: 'draft',
        published_at: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        seo_metadata: null,
        custom_fields: null,
        featured_image_id: 'image-1'
      } as any);

      vi.spyOn((repo as any).authorRepo, 'findByIdOrThrow').mockResolvedValue({ id: 'author-1' } as any);
      vi.spyOn((repo as any).categoryRepo, 'mapFromDatabase').mockImplementation((cat: any) => cat);
      vi.spyOn((repo as any), 'getPostCategories').mockResolvedValue([]);
      vi.spyOn((repo as any), 'getPostTags').mockResolvedValue([]);
      vi.spyOn((repo as any).mediaRepo, 'findById').mockResolvedValue({ id: 'image-1', url: 'https://example.com/img.jpg' } as any);

      const populated = await (repo as any).populateRelations(post);

      expect(populated.featuredImage?.id).toBe('image-1');
    });
  });
});
