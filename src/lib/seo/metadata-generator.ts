import type { 
  SEOMetadata, 
  OpenGraphData, 
  TwitterCardData, 
  ArticleStructuredData 
} from './types.js';
import type { BlogPost, Author } from '../types/index.js';
import {
  DEFAULT_ARTICLE_ROUTING,
  buildArticlePostPath,
  normalizeArticleBasePath,
  normalizeArticlePermalinkStyle,
  type ArticlePermalinkStyle
} from '../routing/articles.js';

export class MetadataGenerator {
  private siteUrl: string;
  private siteName: string;
  private defaultImage: string;
  private twitterHandle?: string;
  private articleBasePath: string;
  private articlePermalinkStyle: ArticlePermalinkStyle;

  constructor(config: {
    siteUrl: string;
    siteName: string;
    defaultImage: string;
    twitterHandle?: string;
    articleBasePath?: string;
    articlePermalinkStyle?: ArticlePermalinkStyle;
  }) {
    this.siteUrl = config.siteUrl.replace(/\/$/, '');
    this.siteName = config.siteName;
    this.defaultImage = config.defaultImage;
    this.twitterHandle = config.twitterHandle;
    this.articleBasePath = normalizeArticleBasePath(config.articleBasePath ?? DEFAULT_ARTICLE_ROUTING.basePath);
    this.articlePermalinkStyle = normalizeArticlePermalinkStyle(config.articlePermalinkStyle ?? DEFAULT_ARTICLE_ROUTING.permalinkStyle);
  }

  /**
   * Generate complete SEO metadata for a blog post
   */
  generatePostMetadata(post: BlogPost, author: Author): SEOMetadata {
    const canonicalPath = buildArticlePostPath(post.slug, post.publishedAt || post.createdAt, {
      basePath: this.articleBasePath,
      permalinkStyle: this.articlePermalinkStyle
    });
    const canonicalUrl = `${this.siteUrl}${canonicalPath.replace(/\/$/, '')}`;
    const imageUrl = post.featuredImage?.url || this.defaultImage;
    
    return {
      title: post.seoMetadata?.metaTitle || post.title,
      description: post.seoMetadata?.metaDescription || post.excerpt || '',
      canonicalUrl,
      noIndex: post.seoMetadata?.noIndex || false,
      noFollow: post.seoMetadata?.noFollow || false,
      openGraph: this.generateOpenGraph(post, author, canonicalUrl, imageUrl),
      twitterCard: this.generateTwitterCard(post, author, imageUrl),
      jsonLd: this.generateArticleStructuredData(post, author, canonicalUrl, imageUrl)
    };
  }

  /**
   * Generate SEO metadata for static pages
   */
  generatePageMetadata(
    title: string,
    description: string,
    path: string = '',
    image?: string
  ): SEOMetadata {
    const canonicalUrl = `${this.siteUrl}${path}`;
    const imageUrl = image || this.defaultImage;

    return {
      title,
      description,
      canonicalUrl,
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        image: imageUrl,
        type: 'website',
        siteName: this.siteName
      },
      twitterCard: {
        card: 'summary_large_image',
        site: this.twitterHandle,
        title,
        description,
        image: imageUrl
      }
    };
  }

  /**
   * Generate Open Graph metadata
   */
  private generateOpenGraph(
    post: BlogPost, 
    author: Author, 
    url: string, 
    imageUrl: string
  ): OpenGraphData {
    return {
      title: post.seoMetadata?.metaTitle || post.title,
      description: post.seoMetadata?.metaDescription || post.excerpt || '',
      url,
      image: imageUrl,
      imageAlt: post.featuredImage?.altText || post.title,
      type: 'article',
      siteName: this.siteName,
      locale: 'en_US',
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      author: author.name,
      section: post.categories[0]?.name,
      tags: post.tags.map(tag => tag.name)
    };
  }

  /**
   * Generate Twitter Card metadata
   */
  private generateTwitterCard(
    post: BlogPost, 
    author: Author, 
    imageUrl: string
  ): TwitterCardData {
    return {
      card: 'summary_large_image',
      site: this.twitterHandle,
      creator: author.socialLinks?.find(link => link.platform === 'twitter')?.url?.replace('https://twitter.com/', '@'),
      title: post.seoMetadata?.metaTitle || post.title,
      description: post.seoMetadata?.metaDescription || post.excerpt || '',
      image: imageUrl,
      imageAlt: post.featuredImage?.altText || post.title
    };
  }

  /**
   * Generate JSON-LD structured data for articles
   */
  private generateArticleStructuredData(
    post: BlogPost, 
    author: Author, 
    url: string, 
    imageUrl: string
  ): ArticleStructuredData {
    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt,
      image: imageUrl,
      datePublished: post.publishedAt?.toISOString(),
      dateModified: post.updatedAt.toISOString(),
      author: {
        '@type': 'Person',
        name: author.name,
        url: author.socialLinks?.find(link => link.platform === 'website')?.url
      },
      publisher: {
        '@type': 'Organization',
        name: this.siteName,
        logo: {
          '@type': 'ImageObject',
          url: this.defaultImage
        }
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': url
      },
      articleSection: post.categories[0]?.name,
      keywords: post.tags.map(tag => tag.name)
    };
  }

  /**
   * Generate meta tags HTML string
   */
  generateMetaTags(metadata: SEOMetadata): string {
    const tags: string[] = [];

    // Basic meta tags
    tags.push(`<title>${this.escapeHtml(metadata.title)}</title>`);
    tags.push(`<meta name="description" content="${this.escapeHtml(metadata.description)}" />`);
    
    if (metadata.canonicalUrl) {
      tags.push(`<link rel="canonical" href="${metadata.canonicalUrl}" />`);
    }

    if (metadata.noIndex) {
      const robotsContent = metadata.noFollow ? 'noindex, nofollow' : 'noindex';
      tags.push(`<meta name="robots" content="${robotsContent}" />`);
    }

    // Open Graph tags
    if (metadata.openGraph) {
      const og = metadata.openGraph;
      if (og.title) tags.push(`<meta property="og:title" content="${this.escapeHtml(og.title)}" />`);
      if (og.description) tags.push(`<meta property="og:description" content="${this.escapeHtml(og.description)}" />`);
      if (og.image) tags.push(`<meta property="og:image" content="${og.image}" />`);
      if (og.imageAlt) tags.push(`<meta property="og:image:alt" content="${this.escapeHtml(og.imageAlt)}" />`);
      if (og.url) tags.push(`<meta property="og:url" content="${og.url}" />`);
      if (og.type) tags.push(`<meta property="og:type" content="${og.type}" />`);
      if (og.siteName) tags.push(`<meta property="og:site_name" content="${this.escapeHtml(og.siteName)}" />`);
      if (og.locale) tags.push(`<meta property="og:locale" content="${og.locale}" />`);
      if (og.publishedTime) tags.push(`<meta property="article:published_time" content="${og.publishedTime}" />`);
      if (og.modifiedTime) tags.push(`<meta property="article:modified_time" content="${og.modifiedTime}" />`);
      if (og.author) tags.push(`<meta property="article:author" content="${this.escapeHtml(og.author)}" />`);
      if (og.section) tags.push(`<meta property="article:section" content="${this.escapeHtml(og.section)}" />`);
      if (og.tags) {
        og.tags.forEach(tag => {
          tags.push(`<meta property="article:tag" content="${this.escapeHtml(tag)}" />`);
        });
      }
    }

    // Twitter Card tags
    if (metadata.twitterCard) {
      const twitter = metadata.twitterCard;
      if (twitter.card) tags.push(`<meta name="twitter:card" content="${twitter.card}" />`);
      if (twitter.site) tags.push(`<meta name="twitter:site" content="${twitter.site}" />`);
      if (twitter.creator) tags.push(`<meta name="twitter:creator" content="${twitter.creator}" />`);
      if (twitter.title) tags.push(`<meta name="twitter:title" content="${this.escapeHtml(twitter.title)}" />`);
      if (twitter.description) tags.push(`<meta name="twitter:description" content="${this.escapeHtml(twitter.description)}" />`);
      if (twitter.image) tags.push(`<meta name="twitter:image" content="${twitter.image}" />`);
      if (twitter.imageAlt) tags.push(`<meta name="twitter:image:alt" content="${this.escapeHtml(twitter.imageAlt)}" />`);
    }

    return tags.join('\n');
  }

  /**
   * Generate JSON-LD script tag
   */
  generateJsonLdScript(jsonLd: Record<string, any>): string {
    return `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
