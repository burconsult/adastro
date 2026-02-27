export interface SEOMetadata {
  title: string;
  description: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  noFollow?: boolean;
  openGraph?: OpenGraphData;
  twitterCard?: TwitterCardData;
  jsonLd?: Record<string, any>;
}

export interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  url?: string;
  type?: 'website' | 'article' | 'blog';
  siteName?: string;
  locale?: string;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
}

export interface TwitterCardData {
  card?: 'summary' | 'summary_large_image' | 'app' | 'player';
  site?: string;
  creator?: string;
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
}

export interface ArticleStructuredData {
  '@context': string;
  '@type': 'Article' | 'BlogPosting';
  headline: string;
  description?: string;
  image?: string | string[];
  datePublished?: string;
  dateModified?: string;
  author?: {
    '@type': 'Person';
    name: string;
    url?: string;
  };
  publisher?: {
    '@type': 'Organization';
    name: string;
    logo?: {
      '@type': 'ImageObject';
      url: string;
    };
  };
  mainEntityOfPage?: {
    '@type': 'WebPage';
    '@id': string;
  };
  articleSection?: string;
  keywords?: string[];
}

export interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export interface RSSItem {
  title: string;
  description: string;
  link: string;
  guid: string;
  pubDate: string;
  author?: string;
  category?: string[];
}