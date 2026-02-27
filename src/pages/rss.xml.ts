import type { APIRoute } from 'astro';
import { RSSGenerator } from '../lib/seo/rss-generator.js';
import { PostRepository } from '../lib/database/repositories/post-repository.js';
import { AuthorRepository } from '../lib/database/repositories/author-repository.js';
import { getSiteContentRouting, getSiteIdentity } from '../lib/site-config.js';
import { resolveSiteUrl } from '../lib/url/site-url.js';

export const GET: APIRoute = async ({ request }) => {
  try {
    const postRepository = new PostRepository();
    const authorRepository = new AuthorRepository();
    
    // Get all published posts
    const posts = await postRepository.findWithFilters({
      status: 'published',
      limit: 20 // RSS feeds typically show recent posts
    });

    // Get all authors for the posts
    const authorIds = [...new Set(posts.map((post: any) => post.author.id))];
    const authors = await Promise.all(
      authorIds.map((id: string) => authorRepository.findById(id))
    );
    const authorMap = new Map(
      authors.filter(Boolean).map(author => [author!.id, author!])
    );

    const siteUrl = resolveSiteUrl(request, import.meta.env.SITE);
    const [identity, contentRouting] = await Promise.all([
      getSiteIdentity(),
      getSiteContentRouting()
    ]);
    const siteName = identity.title || 'Adastro';
    const siteDescription = identity.description || 'A practical, speed-first CMS built with Astro and Supabase.';
    
    const rssGenerator = new RSSGenerator({
      siteUrl,
      siteName,
      siteDescription,
      articleBasePath: contentRouting.articleBasePath,
      articlePermalinkStyle: contentRouting.articlePermalinkStyle
    });
    
    // Generate RSS XML
    const rssXml = rssGenerator.generateRSSFeed(posts, authorMap);

    return new Response(rssXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    return new Response('Error generating RSS feed', { status: 500 });
  }
};
