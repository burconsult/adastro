#!/usr/bin/env node

import { ensureDockerRunning, ensureSupabaseRunning, queryLocalPostgres } from './lib.mjs';

const REQUIRED_SYSTEM_SLUGS = ['home', 'about', 'contact'];
const REQUIRED_NAV_LINKS = ['/about', '/contact'];
const ALLOWED_PATH_PREFIXES = [
  '/admin',
  '/auth',
  '/api',
  '/images/',
  '/favicon',
  '/rss.xml',
  '/sitemap.xml'
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function firstLine(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || '';
}

function queryScalar(sql) {
  return firstLine(queryLocalPostgres(sql));
}

function queryJson(sql) {
  const raw = queryScalar(sql);
  if (!raw) return null;
  return JSON.parse(raw);
}

function quoteSql(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function jsonTextSetting(key, fallback) {
  const value = queryScalar(`
    SELECT COALESCE(
      (
        SELECT CASE
          WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}'
          ELSE NULL
        END
        FROM public.site_settings
        WHERE key = ${quoteSql(key)}
        LIMIT 1
      ),
      ${quoteSql(fallback)}
    );
  `);
  return value || fallback;
}

function extractInternalLinks(value, into) {
  if (typeof value === 'string') {
    if (value.startsWith('/')) {
      into.add(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => extractInternalLinks(entry, into));
    return;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => extractInternalLinks(entry, into));
  }
}

function normalizePath(href) {
  try {
    return new URL(href, 'https://adastro.dev').pathname;
  } catch {
    return href;
  }
}

function extractPostSlug(pathname, articleBasePath) {
  const segments = pathname.split('/').filter(Boolean);
  const baseIndex = segments.indexOf(articleBasePath);
  if (baseIndex === -1) return null;
  const tail = segments.slice(baseIndex + 1);
  if (tail.length === 0) return null;

  const pageIndex = tail.indexOf('page');
  if (pageIndex === 0) return null;

  return tail[tail.length - 1] || null;
}

function validateInternalPath(pathname, context) {
  const {
    articleBasePath,
    pagePaths,
    postSlugs
  } = context;
  const articlePrefix = `/${articleBasePath}`;

  if (pathname === '/' || pagePaths.has(pathname)) return null;
  if (pathname === articlePrefix || pathname.startsWith(`${articlePrefix}/page/`)) return null;
  if (ALLOWED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) return null;

  if (pathname.startsWith(`${articlePrefix}/`)) {
    const postSlug = extractPostSlug(pathname, articleBasePath);
    if (!postSlug || !postSlugs.has(postSlug)) {
      return `missing article for link: ${pathname}`;
    }
    return null;
  }

  return `unresolved internal link: ${pathname}`;
}

function loadLinksSetting(key) {
  const value = queryJson(`
    SELECT value::text
    FROM public.site_settings
    WHERE key = ${quoteSql(key)}
    LIMIT 1;
  `);

  if (!Array.isArray(value)) return null;
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const type = entry.type === 'page' ? 'page' : 'custom';
      const pageSlug = typeof entry.pageSlug === 'string'
        ? entry.pageSlug.trim().toLowerCase().replace(/^\/+|\/+$/g, '')
        : '';
      const label = typeof entry.label === 'string' ? entry.label.trim() : '';
      const href = typeof entry.href === 'string' ? entry.href.trim() : '';

      if (type === 'page') {
        const normalizedSlug = pageSlug || href.replace(/^\/+|\/+$/g, '').toLowerCase() || 'home';
        if (!/^[a-z0-9-]+$/.test(normalizedSlug)) return null;
        return {
          label,
          href: normalizedSlug === 'home' ? '/' : `/${normalizedSlug}`
        };
      }

      if (!label || !href) return null;
      return { label, href };
    })
    .filter(Boolean);
}

function main() {
  ensureDockerRunning();
  ensureSupabaseRunning();

  const articleBasePath = jsonTextSetting('content.articleBasePath', 'blog')
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '') || 'blog';
  const defaultLocale = jsonTextSetting('content.defaultLocale', 'en')
    .trim()
    .toLowerCase() || 'en';
  let activeLocales = queryJson(`
    SELECT COALESCE(
      (
        SELECT CASE
          WHEN jsonb_typeof(value) = 'array' THEN value::text
          ELSE '[]'
        END
        FROM public.site_settings
        WHERE key = 'content.locales'
        LIMIT 1
      ),
      '[]'
    );
  `) || [];

  if (!Array.isArray(activeLocales) || activeLocales.length === 0) {
    activeLocales = [defaultLocale];
  }

  assert(activeLocales.includes(defaultLocale), `Default locale "${defaultLocale}" is missing from content.locales.`);
  assert(activeLocales.length > 0, 'Expected at least one active locale in content.locales.');

  const requiredSlugs = [...new Set([...REQUIRED_SYSTEM_SLUGS, articleBasePath])];
  const requiredSlugsSql = requiredSlugs.map((slug) => quoteSql(slug)).join(',');

  const pages = queryJson(`
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id', id::text,
          'slug', slug,
          'locale', locale,
          'status', status
        )
        ORDER BY slug
      ),
      '[]'::json
    )::text
    FROM public.pages
    WHERE slug = ANY(ARRAY[${requiredSlugsSql}])
      AND locale = ${quoteSql(defaultLocale)};
  `) || [];

  const pageSlugStatus = new Map(pages.map((page) => [page.slug, page.status]));
  for (const slug of requiredSlugs) {
    const status = pageSlugStatus.get(slug);
    assert(Boolean(status), `Missing required page slug: ${slug}`);
    assert(status === 'published', `Required page is not published: ${slug}`);
  }

  const publishedPosts = queryJson(`
    SELECT COALESCE(json_agg(slug ORDER BY slug), '[]'::json)::text
    FROM public.posts
    WHERE status = 'published'
      AND locale = ${quoteSql(defaultLocale)};
  `) || [];
  const postSlugs = new Set(
    publishedPosts
      .map((slug) => (typeof slug === 'string' ? slug.trim() : ''))
      .filter(Boolean)
  );
  assert(postSlugs.size >= 2, `Expected at least 2 published posts in seed content, found ${postSlugs.size}.`);

  const sections = queryJson(`
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'pageSlug', p.slug,
          'sectionType', ps.type,
          'content', ps.content
        )
        ORDER BY p.slug, ps.order_index
      ),
      '[]'::json
    )::text
    FROM public.page_sections ps
    JOIN public.pages p ON p.id = ps.page_id
    WHERE p.slug = ANY(ARRAY[${requiredSlugsSql}])
      AND p.status = 'published'
      AND p.locale = ${quoteSql(defaultLocale)};
  `) || [];

  const sectionCountByPage = new Map();
  for (const section of sections) {
    const slug = typeof section.pageSlug === 'string' ? section.pageSlug : '';
    if (!slug) continue;
    sectionCountByPage.set(slug, (sectionCountByPage.get(slug) || 0) + 1);
  }

  for (const slug of requiredSlugs) {
    const count = sectionCountByPage.get(slug) || 0;
    assert(count > 0, `Required page has no sections: ${slug}`);
  }

  const fallbackNavLinks = [
    { label: 'Articles', href: `/${articleBasePath}` },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' }
  ];

  const topLinks = loadLinksSetting('navigation.topLinks') || fallbackNavLinks;
  const bottomLinks = loadLinksSetting('navigation.bottomLinks') || fallbackNavLinks;
  const articleIndexPath = `/${articleBasePath}`;

  for (const [groupName, links] of [
    ['top', topLinks],
    ['bottom', bottomLinks]
  ]) {
    assert(links.length > 0, `Navigation group "${groupName}" is empty.`);
    const hrefs = new Set(links.map((link) => link.href));
    assert(hrefs.has(articleIndexPath), `Navigation group "${groupName}" is missing ${articleIndexPath}.`);
    for (const requiredHref of REQUIRED_NAV_LINKS) {
      assert(hrefs.has(requiredHref), `Navigation group "${groupName}" is missing ${requiredHref}.`);
    }
  }

  const internalLinks = new Set();
  for (const section of sections) {
    extractInternalLinks(section.content, internalLinks);
  }
  for (const link of [...topLinks, ...bottomLinks]) {
    if (link.href.startsWith('/')) {
      internalLinks.add(link.href);
    }
  }

  const pagePaths = new Set(
    pages.map((page) => (page.slug === 'home' ? '/' : `/${page.slug}`))
  );

  const linkErrors = [];
  for (const href of internalLinks) {
    const pathname = normalizePath(href);
    const error = validateInternalPath(pathname, {
      articleBasePath,
      pagePaths,
      postSlugs
    });
    if (error) {
      linkErrors.push(error);
    }
  }

  if (linkErrors.length > 0) {
    throw new Error(`Default content link checks failed:\n${linkErrors.join('\n')}`);
  }

  console.log(
    `✅ Default content verification passed (defaultLocale=${defaultLocale}, activeLocales=${activeLocales.join(',')}, pages=${requiredSlugs.join(', ')}, posts=${postSlugs.size}, links=${internalLinks.size}).`
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
