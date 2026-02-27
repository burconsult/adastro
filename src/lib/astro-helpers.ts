import { PostRepository } from './database/repositories/post-repository.js';
import { PageRepository } from './database/repositories/page-repository.js';
import { CategoryRepository } from './database/repositories/category-repository.js';
import { TagRepository } from './database/repositories/tag-repository.js';
import type { BlogPost, Category, Tag, PostFilters, Page } from './types/index.js';

// Initialize repositories
const postRepo = new PostRepository();
const pageRepo = new PageRepository();
const categoryRepo = new CategoryRepository();
const tagRepo = new TagRepository();

const FALLBACK_WARNING_PREFIX = '[setup-fallback]';

async function withFallback<T>(scope: string, fallback: T, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.warn(`${FALLBACK_WARNING_PREFIX} ${scope} failed; returning fallback value.`, error);
    return fallback;
  }
}

/**
 * Get all published posts, sorted by publication date (newest first)
 */
export async function getPublishedPosts(limit?: number, offset?: number): Promise<BlogPost[]> {
  return withFallback('getPublishedPosts', [], async () => {
    const filters: PostFilters = {
      status: 'published',
      limit,
      offset,
    };
    
    const posts = await postRepo.findWithFilters(filters);
    return posts.sort((a, b) => {
      const aDate = a.publishedAt || a.createdAt;
      const bDate = b.publishedAt || b.createdAt;
      return bDate.getTime() - aDate.getTime();
    });
  });
}

/**
 * Get a published post by slug
 */
export async function getPublishedPostBySlug(slug: string): Promise<BlogPost | null> {
  return withFallback('getPublishedPostBySlug', null, async () => {
    const post = await postRepo.findBySlug(slug);
    if (!post || post.status !== 'published') {
      return null;
    }
    return post;
  });
}

/**
 * Get all published pages, sorted by updated date
 */
export async function getPublishedPages(): Promise<Page[]> {
  return withFallback('getPublishedPages', [], async () => {
    const pages = await pageRepo.findWithFilters({ status: 'published' });
    return pages.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  });
}

/**
 * Get a published page by slug
 */
export async function getPublishedPageBySlug(slug: string): Promise<Page | null> {
  return withFallback('getPublishedPageBySlug', null, async () => {
    const page = await pageRepo.findBySlug(slug);
    if (!page || page.status !== 'published') {
      return null;
    }
    return page;
  });
}

/**
 * Get all posts for a specific tag
 */
export async function getPostsByTag(tagSlug: string, limit?: number, offset?: number): Promise<BlogPost[]> {
  return withFallback('getPostsByTag', [], async () => {
    const tag = await tagRepo.findBySlug(tagSlug);
    if (!tag) {
      return [];
    }
    
    const filters: PostFilters = {
      status: 'published',
      tagId: tag.id,
      limit,
      offset,
    };
    
    const posts = await postRepo.findWithFilters(filters);
    return posts.sort((a, b) => {
      const aDate = a.publishedAt || a.createdAt;
      const bDate = b.publishedAt || b.createdAt;
      return bDate.getTime() - aDate.getTime();
    });
  });
}

/**
 * Get all posts for a specific category
 */
export async function getPostsByCategory(categorySlug: string, limit?: number, offset?: number): Promise<BlogPost[]> {
  return withFallback('getPostsByCategory', [], async () => {
    const category = await categoryRepo.findBySlug(categorySlug);
    if (!category) {
      return [];
    }
    
    const filters: PostFilters = {
      status: 'published',
      categoryId: category.id,
      limit,
      offset,
    };
    
    const posts = await postRepo.findWithFilters(filters);
    return posts.sort((a, b) => {
      const aDate = a.publishedAt || a.createdAt;
      const bDate = b.publishedAt || b.createdAt;
      return bDate.getTime() - aDate.getTime();
    });
  });
}

/**
 * Get all tags that have published posts
 */
export async function getTagsWithPosts(): Promise<Tag[]> {
  return withFallback('getTagsWithPosts', [], async () => {
    const tags = await tagRepo.findAllWithStats();
    return tags
      .filter(tag => (tag.postCount ?? 0) > 0)
      .map(tag => ({ ...tag, postCount: tag.postCount }));
  });
}

/**
 * Get all categories that have published posts
 */
export async function getCategoriesWithPosts(): Promise<Category[]> {
  return withFallback('getCategoriesWithPosts', [], async () => {
    const categories = await categoryRepo.findAllWithStats();
    return categories
      .filter(category => (category.postCount ?? 0) > 0)
      .map(category => ({ ...category, postCount: category.postCount }));
  });
}

/**
 * Get static paths for all published posts
 */
export async function getPostStaticPaths() {
  const posts = await getPublishedPosts();
  return posts.map(post => ({
    params: { slug: post.slug },
    props: { post }
  }));
}

/**
 * Get static paths for all published pages
 */
export async function getPageStaticPaths() {
  const pages = await getPublishedPages();
  return pages.map(page => ({
    params: { slug: page.slug },
    props: { page }
  }));
}

/**
 * Get static paths for all tags with posts
 */
export async function getTagStaticPaths() {
  const tags = await getTagsWithPosts();
  return tags.map(tag => ({
    params: { tag: tag.slug },
    props: { tag }
  }));
}

/**
 * Get static paths for all categories with posts
 */
export async function getCategoryStaticPaths() {
  const categories = await getCategoriesWithPosts();
  return categories.map(category => ({
    params: { category: category.slug },
    props: { category }
  }));
}

/**
 * Pagination helper
 */
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage?: number;
  prevPage?: number;
}

export function calculatePagination(
  totalItems: number,
  itemsPerPage: number,
  currentPage: number
): PaginationInfo {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;
  
  return {
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? currentPage + 1 : undefined,
    prevPage: hasPrevPage ? currentPage - 1 : undefined,
  };
}
