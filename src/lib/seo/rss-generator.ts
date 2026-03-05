import type { RSSItem } from './types.js';
import type { BlogPost, Author } from '../types/index.js';
import {
  DEFAULT_ARTICLE_ROUTING,
  buildArticlePostPath,
  normalizeArticleBasePath,
  normalizeArticlePermalinkStyle,
  type ArticlePermalinkStyle
} from '../routing/articles.js';

export class RSSGenerator {
  private siteUrl: string;
  private siteName: string;
  private siteDescription: string;
  private language: string;
  private articleBasePath: string;
  private articlePermalinkStyle: ArticlePermalinkStyle;
  private localePrefix: string;

  constructor(config: {
    siteUrl: string;
    siteName: string;
    siteDescription: string;
    language?: string;
    articleBasePath?: string;
    articlePermalinkStyle?: ArticlePermalinkStyle;
    localePrefix?: string;
  }) {
    this.siteUrl = config.siteUrl.replace(/\/$/, '');
    this.siteName = config.siteName;
    this.siteDescription = config.siteDescription;
    this.language = config.language || 'en-us';
    this.articleBasePath = normalizeArticleBasePath(config.articleBasePath ?? DEFAULT_ARTICLE_ROUTING.basePath);
    this.articlePermalinkStyle = normalizeArticlePermalinkStyle(config.articlePermalinkStyle ?? DEFAULT_ARTICLE_ROUTING.permalinkStyle);
    this.localePrefix = typeof config.localePrefix === 'string'
      ? config.localePrefix.trim().replace(/^\/+|\/+$/g, '').toLowerCase()
      : '';
  }

  /**
   * Generate RSS feed from blog posts
   */
  generateRSSFeed(posts: BlogPost[], authors: Map<string, Author>): string {
    const items: RSSItem[] = posts
      .filter(post => post.status === 'published' && post.publishedAt)
      .sort((a, b) => (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0))
      .slice(0, 20) // Limit to 20 most recent posts
      .map(post => this.postToRSSItem(post, authors.get(post.author.id)));

    return this.generateXML(items);
  }

  /**
   * Convert blog post to RSS item
   */
  private postToRSSItem(post: BlogPost, author?: Author): RSSItem {
    const postPath = buildArticlePostPath(post.slug, post.publishedAt || post.createdAt, {
      basePath: this.articleBasePath,
      permalinkStyle: this.articlePermalinkStyle,
      localePrefix: this.localePrefix
    }).replace(/\/$/, '');
    return {
      title: post.title,
      description: post.excerpt || this.stripHtml(post.content).substring(0, 300) + '...',
      link: `${this.siteUrl}${postPath}`,
      guid: `${this.siteUrl}${postPath}`,
      pubDate: post.publishedAt?.toUTCString() || new Date().toUTCString(),
      author: author?.name,
      category: post.categories.map(cat => cat.name)
    };
  }

  /**
   * Generate RSS XML string
   */
  private generateXML(items: RSSItem[]): string {
    const itemElements = items.map(item => {
      let itemXml = `    <item>
      <title>${this.escapeXml(item.title)}</title>
      <description><![CDATA[${item.description}]]></description>
      <link>${item.link}</link>
      <guid isPermaLink="true">${item.guid}</guid>
      <pubDate>${item.pubDate}</pubDate>`;

      if (item.author) {
        itemXml += `\n      <author>${this.escapeXml(item.author)}</author>`;
      }

      if (item.category && item.category.length > 0) {
        item.category.forEach(cat => {
          itemXml += `\n      <category>${this.escapeXml(cat)}</category>`;
        });
      }

      itemXml += '\n    </item>';
      return itemXml;
    });

    const lastBuildDate = items.length > 0 ? items[0].pubDate : new Date().toUTCString();

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${this.escapeXml(this.siteName)}</title>
    <description>${this.escapeXml(this.siteDescription)}</description>
    <link>${this.siteUrl}</link>
    <language>${this.language}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${this.siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
${itemElements.join('\n')}
  </channel>
</rss>`;
  }

  /**
   * Strip HTML tags from content
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
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
