import type { APIRoute } from 'astro';
import { SitemapGenerator } from '../lib/seo/sitemap-generator.js';
import { PostRepository } from '../lib/database/repositories/post-repository.js';
import { PageRepository } from '../lib/database/repositories/page-repository.js';
import { getSiteContentRouting, getSiteLocaleConfig } from '../lib/site-config.js';
import { resolveSiteUrl } from '../lib/url/site-url.js';

export const GET: APIRoute = async ({ request }) => {
  try {
    const postRepository = new PostRepository();
    const pageRepository = new PageRepository();
    
    const siteUrl = resolveSiteUrl(request, import.meta.env.SITE);
    const [contentRouting, localeConfig] = await Promise.all([
      getSiteContentRouting(),
      getSiteLocaleConfig()
    ]);

    const allEntries = [];
    for (const locale of localeConfig.locales) {
      const [posts, pages] = await Promise.all([
        postRepository.findWithFilters({
          status: 'published',
          locale
        }),
        pageRepository.findWithFilters({
          status: 'published',
          locale
        })
      ]);

      const localeGenerator = new SitemapGenerator(siteUrl, {
        articleBasePath: contentRouting.articleBasePath,
        articlePermalinkStyle: contentRouting.articlePermalinkStyle,
        localePrefix: locale
      });

      const pageEntries = pages.map((page) => ({
        url: page.slug === 'home' ? `${siteUrl}/${locale}` : `${siteUrl}/${locale}/${page.slug}`,
        lastmod: page.updatedAt.toISOString().split('T')[0],
        changefreq: 'weekly' as const,
        priority: page.slug === 'home' ? 1.0 : 0.7
      }));

      allEntries.push(...localeGenerator.collectEntries(posts, pageEntries));
    }

    const dedupedByUrl = new Map<string, (typeof allEntries)[number]>();
    allEntries.forEach((entry) => {
      if (!dedupedByUrl.has(entry.url)) {
        dedupedByUrl.set(entry.url, entry);
      }
    });

    const sitemapGenerator = new SitemapGenerator(siteUrl, {
      articleBasePath: contentRouting.articleBasePath,
      articlePermalinkStyle: contentRouting.articlePermalinkStyle
    });
    const sitemapXml = sitemapGenerator.generateXML(Array.from(dedupedByUrl.values()));

    return new Response(sitemapXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response('Error generating sitemap', { status: 500 });
  }
};
