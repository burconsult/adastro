import type { APIRoute } from 'astro';
import { SitemapGenerator } from '../lib/seo/sitemap-generator.js';
import { PostRepository } from '../lib/database/repositories/post-repository.js';
import { PageRepository } from '../lib/database/repositories/page-repository.js';
import { getSiteContentRouting } from '../lib/site-config.js';
import { resolveSiteUrl } from '../lib/url/site-url.js';

export const GET: APIRoute = async ({ request }) => {
  try {
    const postRepository = new PostRepository();
    const pageRepository = new PageRepository();
    
    // Get all published posts
    const posts = await postRepository.findWithFilters({
      status: 'published'
    });
    const pages = await pageRepository.findWithFilters({
      status: 'published'
    });

    const siteUrl = resolveSiteUrl(request, import.meta.env.SITE);
    
    const contentRouting = await getSiteContentRouting();
    const sitemapGenerator = new SitemapGenerator(siteUrl, {
      articleBasePath: contentRouting.articleBasePath,
      articlePermalinkStyle: contentRouting.articlePermalinkStyle
    });

    const pageEntries = pages.map((page) => ({
      url: page.slug === 'home' ? `${siteUrl}/` : `${siteUrl}/${page.slug}`,
      lastmod: page.updatedAt.toISOString().split('T')[0],
      changefreq: 'weekly' as const,
      priority: page.slug === 'home' ? 1.0 : 0.7
    }));
    
    // Generate sitemap XML
    const sitemapXml = sitemapGenerator.generateSitemap(posts, pageEntries);

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
