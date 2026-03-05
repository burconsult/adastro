import { describe, expect, it } from 'vitest';
import {
  applyArticleBasePathToHref,
  buildArticlePostPath,
  buildArticlesIndexPath,
  buildArticlesPagePath,
  normalizeArticleBasePath,
  normalizeArticleRoutingConfig,
  resolveLegacyBlogPath
} from '../articles';

describe('article routing helpers', () => {
  it('normalizes base path and blocks reserved values', () => {
    expect(normalizeArticleBasePath('articles')).toBe('articles');
    expect(normalizeArticleBasePath('/posts/')).toBe('posts');
    expect(normalizeArticleBasePath('admin')).toBe('blog');
    expect(normalizeArticleBasePath('bad path')).toBe('blog');
  });

  it('builds index and paginated paths from routing config', () => {
    expect(buildArticlesIndexPath({ basePath: 'posts' })).toBe('/posts');
    expect(buildArticlesPagePath(1, { basePath: 'posts' })).toBe('/posts');
    expect(buildArticlesPagePath(4, { basePath: 'posts' })).toBe('/posts/page/4/');
  });

  it('builds segment post path by default', () => {
    expect(
      buildArticlePostPath('hello-world', '2026-02-14T12:00:00Z', {
        basePath: 'articles',
        permalinkStyle: 'segment'
      })
    ).toBe('/articles/hello-world/');
  });

  it('builds wordpress-style post path when configured and date is valid', () => {
    expect(
      buildArticlePostPath('hello-world', '2026-02-14T12:00:00Z', {
        basePath: 'articles',
        permalinkStyle: 'wordpress'
      })
    ).toBe('/2026/02/14/hello-world/');
  });

  it('falls back to segment path if wordpress style has invalid date', () => {
    expect(
      buildArticlePostPath('hello-world', 'not-a-date', {
        basePath: 'articles',
        permalinkStyle: 'wordpress'
      })
    ).toBe('/articles/hello-world/');
  });

  it('rewrites legacy /blog hrefs for custom base paths', () => {
    expect(applyArticleBasePathToHref('/blog', { basePath: 'posts' })).toBe('/posts');
    expect(applyArticleBasePathToHref('/blog/my-post', { basePath: 'posts' })).toBe('/posts/my-post');
    expect(applyArticleBasePathToHref('/contact', { basePath: 'posts' })).toBe('/contact');
  });

  it('resolves custom base paths back to legacy /blog routes', () => {
    expect(resolveLegacyBlogPath('/posts', { basePath: 'posts', permalinkStyle: 'segment' })).toBe('/blog');
    expect(resolveLegacyBlogPath('/posts/page/2', { basePath: 'posts', permalinkStyle: 'segment' })).toBe('/blog/page/2/');
    expect(resolveLegacyBlogPath('/posts/my-post', { basePath: 'posts', permalinkStyle: 'segment' })).toBe('/blog/my-post/');
    expect(resolveLegacyBlogPath('/2026/02/14/my-post', { basePath: 'posts', permalinkStyle: 'wordpress' })).toBe('/blog/my-post/');
    expect(resolveLegacyBlogPath('/blog/my-post', { basePath: 'blog', permalinkStyle: 'segment' })).toBeNull();
  });

  it('normalizes partial routing config to defaults', () => {
    expect(normalizeArticleRoutingConfig({ basePath: 'articles' })).toEqual({
      basePath: 'articles',
      permalinkStyle: 'segment',
      localePrefix: ''
    });
    expect(normalizeArticleRoutingConfig({ basePath: 'admin', permalinkStyle: 'wordpress' })).toEqual({
      basePath: 'blog',
      permalinkStyle: 'wordpress',
      localePrefix: ''
    });
  });
});
