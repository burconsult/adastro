import type { SitemapEntry } from './types.js';
import type { BlogPost } from '../types/index.js';
import {
  DEFAULT_ARTICLE_ROUTING,
  buildArticlePostPath,
  buildArticlesIndexPath,
  normalizeArticleBasePath,
  normalizeArticlePermalinkStyle,
  type ArticlePermalinkStyle
} from '../routing/articles.js';

export class SitemapGenerator {
  private siteUrl: string;
  private articleBasePath: string;
  private articlePermalinkStyle: ArticlePermalinkStyle;

  constructor(siteUrl: string, config?: { articleBasePath?: string; articlePermalinkStyle?: ArticlePermalinkStyle }) {
    this.siteUrl = siteUrl.replace(/\/$/, '');
    this.articleBasePath = normalizeArticleBasePath(config?.articleBasePath ?? DEFAULT_ARTICLE_ROUTING.basePath);
    this.articlePermalinkStyle = normalizeArticlePermalinkStyle(config?.articlePermalinkStyle ?? DEFAULT_ARTICLE_ROUTING.permalinkStyle);
  }

  /**
   * Generate XML sitemap from posts and static pages
   */
  generateSitemap(posts: BlogPost[], staticPages: SitemapEntry[] = []): string {
    const entries: SitemapEntry[] = [];

    // Add static pages
    entries.push(...staticPages);

    // Add blog posts
    posts.forEach(post => {
      if (post.status === 'published' && post.publishedAt) {
        const postPath = buildArticlePostPath(post.slug, post.publishedAt || post.createdAt, {
          basePath: this.articleBasePath,
          permalinkStyle: this.articlePermalinkStyle
        }).replace(/\/$/, '');
        entries.push({
          url: `${this.siteUrl}${postPath}`,
          lastmod: post.updatedAt.toISOString().split('T')[0],
          changefreq: 'weekly',
          priority: 0.8
        });
      }
    });

    // Add category pages
    const categories = new Set(posts.flatMap(post => post.categories.map(cat => cat.slug)));
    categories.forEach(categorySlug => {
      entries.push({
        url: `${this.siteUrl}/category/${categorySlug}`,
        changefreq: 'weekly',
        priority: 0.6
      });
    });

    // Add tag pages
    const tags = new Set(posts.flatMap(post => post.tags.map(tag => tag.slug)));
    tags.forEach(tagSlug => {
      entries.push({
        url: `${this.siteUrl}/tag/${tagSlug}`,
        changefreq: 'weekly',
        priority: 0.5
      });
    });

    return this.generateXML(entries);
  }

  /**
   * Generate default static pages entries
   */
  getDefaultStaticPages(): SitemapEntry[] {
    const articleIndexPath = buildArticlesIndexPath({
      basePath: this.articleBasePath,
      permalinkStyle: this.articlePermalinkStyle
    });
    return [
      {
        url: `${this.siteUrl}/`,
        changefreq: 'daily',
        priority: 1.0
      },
      {
        url: `${this.siteUrl}${articleIndexPath}`,
        changefreq: 'daily',
        priority: 0.9
      },
      {
        url: `${this.siteUrl}/about`,
        changefreq: 'monthly',
        priority: 0.7
      },
      {
        url: `${this.siteUrl}/contact`,
        changefreq: 'monthly',
        priority: 0.6
      }
    ];
  }

  /**
   * Generate XML sitemap string
   */
  private generateXML(entries: SitemapEntry[]): string {
    const urlElements = entries.map(entry => {
      let urlXml = `  <url>\n    <loc>${this.escapeXml(entry.url)}</loc>`;
      
      if (entry.lastmod) {
        urlXml += `\n    <lastmod>${entry.lastmod}</lastmod>`;
      }
      
      if (entry.changefreq) {
        urlXml += `\n    <changefreq>${entry.changefreq}</changefreq>`;
      }
      
      if (entry.priority !== undefined) {
        urlXml += `\n    <priority>${entry.priority.toFixed(1)}</priority>`;
      }
      
      urlXml += '\n  </url>';
      return urlXml;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements.join('\n')}
</urlset>`;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
