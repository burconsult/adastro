import sanitizeHtmlLibrary from 'sanitize-html';
import type { 
  Author, 
  BlogPost, 
  Category, 
  Tag, 
  MediaAsset,
  SEOMetadata 
} from '../types';

/**
 * Sanitizes HTML content by removing potentially dangerous elements
 */
export function sanitizeHtml(content: unknown): string {
  const raw = typeof content === 'string' ? content : content == null ? '' : String(content);

  return sanitizeHtmlLibrary(raw, {
    allowedTags: [
      'p',
      'br',
      'div',
      'span',
      'strong',
      'em',
      'b',
      'i',
      'u',
      's',
      'blockquote',
      'cite',
      'ul',
      'ol',
      'li',
      'a',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'hr',
      'pre',
      'code',
      'figure',
      'figcaption',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'iframe'
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
      iframe: ['src', 'title', 'allow', 'allowfullscreen', 'loading', 'width', 'height'],
      '*': ['class']
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data']
    },
    allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'],
    transformTags: {
      a: (_tagName, attribs) => {
        const next = { ...attribs };
        if (next.target === '_blank') {
          const relTokens = new Set((next.rel || '').split(/\s+/).filter(Boolean));
          relTokens.add('noopener');
          relTokens.add('noreferrer');
          next.rel = Array.from(relTokens).join(' ');
        }
        return { tagName: 'a', attribs: next };
      }
    },
    disallowedTagsMode: 'discard'
  });
}

/**
 * Generates a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Extracts excerpt from content if not provided
 */
export function generateExcerpt(content: string, maxLength: number = 160): string {
  // Remove markdown/HTML formatting for excerpt
  const plainText = content
    .replace(/#{1,6}\s+/g, '') // Remove markdown headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
    .replace(/\*(.*?)\*/g, '$1') // Remove italic formatting
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  // Find the last complete word within the limit
  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  return lastSpace > 0 
    ? truncated.substring(0, lastSpace) + '...'
    : truncated + '...';
}

function parseDimensionsValue(value: unknown): { width: number; height: number } | undefined {
  if (!value) return undefined;

  let parsed = value as any;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return undefined;
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }

  const width = Number((parsed as any).width);
  const height = Number((parsed as any).height);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return undefined;
  }

  return { width, height };
}

/**
 * Transforms database row to Author object
 */
export function transformDbAuthor(row: any): Author {
  const emailValue = row.email;
  const slugValue = row.slug;
  const fallbackSlugSource = typeof emailValue === 'string'
    ? emailValue.split('@')[0]
    : row.name;
  return {
    id: row.id,
    name: row.name,
    slug: typeof slugValue === 'string' && slugValue.length > 0
      ? slugValue
      : generateSlug(fallbackSlugSource || 'author'),
    email: row.email,
    bio: row.bio || undefined,
    avatar: row.avatar_url ? {
      id: '', // Will be populated from media table if needed
      filename: '',
      url: row.avatar_url,
      storagePath: '',
      mimeType: '',
      fileSize: 0,
      createdAt: new Date(),
    } : undefined,
    socialLinks: row.social_links ? JSON.parse(row.social_links) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Transforms database row to Category object
 */
export function transformDbCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || undefined,
    parentId: row.parent_id || undefined,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Transforms database row to Tag object
 */
export function transformDbTag(row: any): Tag {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Transforms database row to MediaAsset object
 */
export function transformDbMediaAsset(row: any): MediaAsset {
  const storagePath = row.storage_path || '';
  const isDirectUrl = typeof storagePath === 'string' && (storagePath.startsWith('http') || storagePath.startsWith('/'));
  const fallbackUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/media/${storagePath}`;
  return {
    id: row.id,
    filename: row.filename,
    url: row.url || (isDirectUrl ? storagePath : fallbackUrl),
    storagePath,
    altText: row.alt_text || undefined,
    caption: row.caption || undefined,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    dimensions: parseDimensionsValue(row.dimensions),
    createdAt: new Date(row.created_at),
  };
}

/**
 * Transforms database row to BlogPost object
 */
export function transformDbBlogPost(row: any, author: Author, categories: Category[], tags: Tag[], featuredImage?: MediaAsset): BlogPost {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    excerpt: row.excerpt || generateExcerpt(row.content),
    author,
    publishedAt: row.published_at ? new Date(row.published_at) : undefined,
    updatedAt: new Date(row.updated_at),
    createdAt: new Date(row.created_at),
    status: row.status,
    categories,
    tags,
    featuredImage,
    seoMetadata: row.seo_metadata ? JSON.parse(row.seo_metadata) : undefined,
    customFields: row.custom_fields ? JSON.parse(row.custom_fields) : undefined,
  };
}

/**
 * Prepares Author data for database insertion
 */
export function prepareAuthorForDb(author: Partial<Author>) {
  const slugSource = author.slug
    || author.email?.split('@')[0]
    || author.name
    || 'author';
  return {
    name: author.name,
    email: author.email,
    slug: generateSlug(slugSource),
    bio: author.bio || null,
    avatar_url: author.avatar?.url || null,
    social_links: author.socialLinks ? JSON.stringify(author.socialLinks) : null,
  };
}

/**
 * Prepares Category data for database insertion
 */
export function prepareCategoryForDb(category: Partial<Category>) {
  return {
    name: category.name,
    slug: category.slug || generateSlug(category.name || ''),
    description: category.description || null,
    parent_id: category.parentId || null,
  };
}

/**
 * Prepares Tag data for database insertion
 */
export function prepareTagForDb(tag: Partial<Tag>) {
  return {
    name: tag.name,
    slug: tag.slug || generateSlug(tag.name || ''),
  };
}

/**
 * Prepares MediaAsset data for database insertion
 */
export function prepareMediaAssetForDb(asset: Partial<MediaAsset>) {
  return {
    filename: asset.filename,
    storage_path: asset.storagePath,
    alt_text: asset.altText || null,
    caption: asset.caption || null,
    mime_type: asset.mimeType,
    file_size: asset.fileSize,
    dimensions: asset.dimensions ? JSON.stringify(asset.dimensions) : null,
  };
}

/**
 * Prepares BlogPost data for database insertion
 */
export function prepareBlogPostForDb(post: Partial<BlogPost>) {
  return {
    title: post.title,
    slug: post.slug || generateSlug(post.title || ''),
    content: sanitizeHtml(post.content || ''),
    excerpt: post.excerpt || (post.content ? generateExcerpt(post.content) : null),
    author_id: post.author?.id,
    status: post.status || 'draft',
    published_at: post.publishedAt || null,
    seo_metadata: post.seoMetadata ? JSON.stringify(post.seoMetadata) : null,
    custom_fields: post.customFields ? JSON.stringify(post.customFields) : null,
  };
}

/**
 * Validates and normalizes SEO metadata
 */
export function normalizeSEOMetadata(metadata: Partial<SEOMetadata>, post: Partial<BlogPost>): SEOMetadata {
  return {
    metaTitle: metadata.metaTitle || post.title?.substring(0, 60),
    metaDescription: metadata.metaDescription || post.excerpt?.substring(0, 160),
    canonicalUrl: metadata.canonicalUrl,
    noIndex: metadata.noIndex || false,
    openGraph: {
      title: metadata.openGraph?.title || metadata.metaTitle || post.title?.substring(0, 60),
      description: metadata.openGraph?.description || metadata.metaDescription || post.excerpt?.substring(0, 160),
      image: metadata.openGraph?.image || post.featuredImage?.url,
      type: metadata.openGraph?.type || 'article',
      url: metadata.openGraph?.url || metadata.canonicalUrl,
    },
    twitterCard: {
      card: metadata.twitterCard?.card || 'summary_large_image',
      title: metadata.twitterCard?.title || metadata.metaTitle || post.title?.substring(0, 60),
      description: metadata.twitterCard?.description || metadata.metaDescription || post.excerpt?.substring(0, 160),
      image: metadata.twitterCard?.image || post.featuredImage?.url,
    },
  };
}
