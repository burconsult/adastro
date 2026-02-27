import { XMLParser } from 'fast-xml-parser';
import type {
  WordPressAttachment,
  WordPressAuthor,
  WordPressCategory,
  WordPressData,
  WordPressPost,
  WordPressPostMeta,
  WordPressPostTaxonomy,
  WordPressSiteInfo,
  WordPressTag
} from './types.js';

/**
 * WordPress WXR (WordPress eXtended RSS) Parser
 */
export class WXRParser {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      parseTagValue: true,
      trimValues: true,
      // WXR imports are untrusted uploads; disable XML entity processing to reduce XXE/DoS surface.
      processEntities: false
    });
  }

  /**
   * Parse WordPress WXR export file
   */
  async parseWXR(xmlContent: string): Promise<WordPressData> {
    try {
      const parsed = this.parser.parse(xmlContent);
      const rss = parsed.rss;

      if (!rss || !rss.channel) {
        throw new Error('Invalid WXR format: missing RSS channel');
      }

      const channel = rss.channel;
      const items = Array.isArray(channel.item) ? channel.item : [channel.item].filter(Boolean);

      return {
        site: this.extractSiteInfo(channel),
        authors: this.extractAuthors(channel),
        categories: this.extractCategories(channel),
        tags: this.extractTags(channel),
        posts: this.extractPosts(items),
        attachments: this.extractAttachments(items)
      };
    } catch (error) {
      throw new Error(`WXR parsing failed: ${error.message}`);
    }
  }

  /**
   * Extract site information
   */
  private extractSiteInfo(channel: any): WordPressSiteInfo {
    return {
      title: channel.title || '',
      link: channel.link || '',
      description: channel.description || '',
      language: channel.language || 'en',
      baseSiteUrl: channel['wp:base_site_url'] || '',
      baseBlogUrl: channel['wp:base_blog_url'] || ''
    };
  }

  /**
   * Extract authors from WXR
   */
  private extractAuthors(channel: any): WordPressAuthor[] {
    const authors = channel['wp:author'];
    if (!authors) return [];

    const authorArray = Array.isArray(authors) ? authors : [authors];

    return authorArray.map((author: any) => ({
      authorId: parseInt(author['wp:author_id']) || 0,
      authorLogin: author['wp:author_login'] || '',
      authorEmail: author['wp:author_email'] || '',
      authorDisplayName: author['wp:author_display_name'] || '',
      authorFirstName: author['wp:author_first_name'] || '',
      authorLastName: author['wp:author_last_name'] || ''
    }));
  }

  /**
   * Extract categories from WXR
   */
  private extractCategories(channel: any): WordPressCategory[] {
    const categories = channel['wp:category'];
    if (!categories) return [];

    const categoryArray = Array.isArray(categories) ? categories : [categories];

    return categoryArray.map((category: any) => ({
      termId: parseInt(category['wp:term_id']) || 0,
      categoryNicename: category['wp:category_nicename'] || '',
      categoryParent: category['wp:category_parent'] || '',
      catName: category['wp:cat_name'] || '',
      categoryDescription: category['wp:category_description'] || ''
    }));
  }

  /**
   * Extract tags from WXR
   */
  private extractTags(channel: any): WordPressTag[] {
    const tags = channel['wp:tag'];
    if (!tags) return [];

    const tagArray = Array.isArray(tags) ? tags : [tags];

    return tagArray.map((tag: any) => ({
      termId: parseInt(tag['wp:term_id']) || 0,
      tagSlug: tag['wp:tag_slug'] || '',
      tagName: tag['wp:tag_name'] || '',
      tagDescription: tag['wp:tag_description'] || ''
    }));
  }

  /**
   * Extract posts from WXR items
   */
  private extractPosts(items: any[]): WordPressPost[] {
    return items
      .filter(item => item['wp:post_type'] === 'post' && item['wp:status'] !== 'trash')
      .map(item => this.parsePostItem(item));
  }

  /**
   * Extract attachments from WXR items
   */
  private extractAttachments(items: any[]): WordPressAttachment[] {
    return items
      .filter(item => item['wp:post_type'] === 'attachment')
      .map(item => ({
        attachmentUrl: item['wp:attachment_url'] || '',
        postId: parseInt(item['wp:post_id']) || 0,
        postTitle: item.title || '',
        postExcerpt: item['excerpt:encoded'] || '',
        postContent: item['content:encoded'] || '',
        postParent: parseInt(item['wp:post_parent']) || 0
      }));
  }

  /**
   * Parse individual post item
   */
  private parsePostItem(item: any): WordPressPost {
    const taxonomies = this.extractPostTaxonomies(item.category);
    const postmeta = this.extractPostMeta(item['wp:postmeta']);

    return {
      title: item.title || '',
      link: item.link || '',
      pubDate: item.pubDate || '',
      creator: item['dc:creator'] || '',
      guid: item.guid?.['#text'] || item.guid || '',
      description: item.description || '',
      content: item['content:encoded'] || '',
      excerpt: item['excerpt:encoded'] || '',
      postId: parseInt(item['wp:post_id']) || 0,
      postDate: item['wp:post_date'] || '',
      postDateGmt: item['wp:post_date_gmt'] || '',
      commentStatus: item['wp:comment_status'] || 'closed',
      pingStatus: item['wp:ping_status'] || 'closed',
      postName: item['wp:post_name'] || '',
      status: item['wp:status'] || 'draft',
      postParent: parseInt(item['wp:post_parent']) || 0,
      menuOrder: parseInt(item['wp:menu_order']) || 0,
      postType: item['wp:post_type'] || 'post',
      postPassword: item['wp:post_password'] || '',
      isSticky: parseInt(item['wp:is_sticky']) || 0,
      taxonomies,
      postmeta
    };
  }

  /**
   * Extract post taxonomies (categories and tags)
   */
  private extractPostTaxonomies(categories: any): WordPressPostTaxonomy[] {
    if (!categories) return [];

    const categoryArray = Array.isArray(categories) ? categories : [categories];
    return categoryArray
      .filter((cat) => cat && cat['@_nicename'])
      .map((cat) => ({
        slug: cat['@_nicename'],
        domain: cat['@_domain'] || 'category'
      }));
  }

  /**
   * Extract post meta data
   */
  private extractPostMeta(postmeta: any): WordPressPostMeta[] {
    if (!postmeta) return [];

    const metaArray = Array.isArray(postmeta) ? postmeta : [postmeta];
    return metaArray.map(meta => ({
      metaKey: meta['wp:meta_key'] || '',
      metaValue: meta['wp:meta_value'] || ''
    }));
  }
}
