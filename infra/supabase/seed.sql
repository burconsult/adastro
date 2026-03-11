-- Seed data for AdAstro OSS demo
-- Inserts sample author + content (no auth users created)

INSERT INTO authors (id, name, email, slug, bio) VALUES
  (
    '550e8400-e29b-41d4-a716-446655440101',
    'Adastro Team',
    'hello@example.com',
    'adastro-team',
    'Staff writer covering Adastro migrations, AI workflows, and performance wins.'
  )
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      email = EXCLUDED.email,
      slug = EXCLUDED.slug,
      bio = EXCLUDED.bio,
      updated_at = NOW();

-- Insert categories
INSERT INTO categories (id, name, slug, description) VALUES
  ('650e8400-e29b-41d4-a716-446655440010', 'Performance', 'performance', 'Core Web Vitals, PageSpeed, and fast publishing.'),
  ('650e8400-e29b-41d4-a716-446655440011', 'SEO', 'seo', 'Search visibility, metadata, and structured data.'),
  ('650e8400-e29b-41d4-a716-446655440012', 'AI', 'ai', 'Automation and assistive workflows for editors.'),
  ('650e8400-e29b-41d4-a716-446655440013', 'Open Source', 'open-source', 'Forkable tooling and community-driven publishing.')
ON CONFLICT (slug) DO NOTHING;

-- Insert tags
INSERT INTO tags (id, name, slug) VALUES
  ('750e8400-e29b-41d4-a716-446655440020', 'Astro', 'astro'),
  ('750e8400-e29b-41d4-a716-446655440021', 'PageSpeed Insights', 'pagespeed-insights'),
  ('750e8400-e29b-41d4-a716-446655440022', 'Core Web Vitals', 'core-web-vitals'),
  ('750e8400-e29b-41d4-a716-446655440023', 'SEO Automation', 'seo-automation'),
  ('750e8400-e29b-41d4-a716-446655440024', 'Nano Banana', 'nano-banana'),
  ('750e8400-e29b-41d4-a716-446655440025', 'AI', 'ai'),
  ('750e8400-e29b-41d4-a716-446655440026', 'Open Source', 'open-source')
ON CONFLICT (slug) DO NOTHING;

-- Insert demo media assets used by seeded content
INSERT INTO media_assets (
  id,
  filename,
  storage_path,
  alt_text,
  mime_type,
  file_size,
  dimensions,
  uploaded_by
) VALUES
  (
    '850e8400-e29b-41d4-a716-446655440001',
    'article_image_01.webp',
    '/images/article_image_01.webp',
    'AdAstro demo article image 01',
    'image/webp',
    35078,
    '{"width":1600,"height":900}'::jsonb,
    (SELECT id FROM authors WHERE email = 'hello@example.com')
  ),
  (
    '850e8400-e29b-41d4-a716-446655440002',
    'article_image_02.webp',
    '/images/article_image_02.webp',
    'AdAstro demo article image 02',
    'image/webp',
    29764,
    '{"width":1600,"height":900}'::jsonb,
    (SELECT id FROM authors WHERE email = 'hello@example.com')
  ),
  (
    '850e8400-e29b-41d4-a716-446655440003',
    'article_image_03.webp',
    '/images/article_image_03.webp',
    'AdAstro demo article image 03',
    'image/webp',
    24918,
    '{"width":1600,"height":900}'::jsonb,
    (SELECT id FROM authors WHERE email = 'hello@example.com')
  )
ON CONFLICT (id) DO UPDATE
SET filename = EXCLUDED.filename,
    storage_path = EXCLUDED.storage_path,
    alt_text = EXCLUDED.alt_text,
    mime_type = EXCLUDED.mime_type,
    file_size = EXCLUDED.file_size,
    dimensions = EXCLUDED.dimensions,
    uploaded_by = EXCLUDED.uploaded_by;

-- Insert sample posts
INSERT INTO posts (id, title, slug, locale, content, excerpt, author_id, featured_image_id, status, published_at, seo_metadata) VALUES
  (
    '950e8400-e29b-41d4-a716-446655440030',
    'How AdAstro keeps publishing fast as content grows',
    'pagespeed-90-without-plugins',
    'en',
    '<h2>Fast by default, not by accident</h2><p>AdAstro keeps things lean with server-first rendering, predictable templates, and minimal client JavaScript.</p><h2>What matters most</h2><ul><li>Stable layout primitives to protect CLS</li><li>Media workflow that avoids oversized uploads</li><li>Simple SEO defaults with no plugin overhead</li></ul><h2>Practical workflow</h2><p>Teams can publish daily content without watching performance slip week by week.</p>',
    'A practical breakdown of the publishing defaults that keep AdAstro fast without heavy plugin stacks.',
    (SELECT id FROM authors WHERE email = 'hello@example.com'),
    '850e8400-e29b-41d4-a716-446655440001',
    'published',
    NOW() - INTERVAL '6 days',
    '{"metaTitle": "How AdAstro stays fast at scale", "metaDescription": "See how AdAstro maintains strong Core Web Vitals with practical publishing defaults."}'::jsonb
  ),
  (
    '950e8400-e29b-41d4-a716-446655440031',
    'AI tools in AdAstro: useful by default, optional by design',
    'ai-seo-autopilot-nano-banana',
    'en',
    '<h2>AI should reduce friction, not remove control</h2><p>The bundled AI feature can draft metadata and content helpers, but every output stays reviewable before publish.</p><h2>Recommended workflow</h2><ol><li>Use AI to draft.</li><li>Edit tone and facts.</li><li>Publish only after human review.</li></ol><p>This keeps output consistent without turning your CMS into a black box.</p>',
    'A realistic AI workflow for editors: optional automation, clear review, and predictable outcomes.',
    (SELECT id FROM authors WHERE email = 'hello@example.com'),
    '850e8400-e29b-41d4-a716-446655440002',
    'published',
    NOW() - INTERVAL '4 days',
    '{"metaTitle": "Optional AI workflows in AdAstro", "metaDescription": "Use AdAstro AI features for drafts and metadata while keeping full editorial control."}'::jsonb
  ),
  (
    '950e8400-e29b-41d4-a716-446655440032',
    'Release checklist: keep your first launch clean and calm',
    'release-checklist-clean-launch',
    'en',
    '<h2>Before launch day</h2><p>Confirm core routes, test auth flow, and keep feature flags intentional.</p><h2>What to verify</h2><ul><li>Core pages and menus render as expected</li><li>Feature modules stay inactive until enabled</li><li>Media and SEO metadata behave predictably</li></ul><p>A calm launch is usually the result of a small, repeatable checklist.</p>',
    'A practical pre-launch checklist to keep installs predictable and production-ready.',
    (SELECT id FROM authors WHERE email = 'hello@example.com'),
    '850e8400-e29b-41d4-a716-446655440003',
    'published',
    NOW() - INTERVAL '3 days',
    '{"metaTitle": "AdAstro launch checklist", "metaDescription": "Use this lightweight checklist to validate routing, auth, and modular feature states before launch."}'::jsonb
  ),
  (
    '950e8400-e29b-41d4-a716-446655440033',
    'Editorial workflow with modular features switched on only when needed',
    'editorial-workflow-modular-features',
    'en',
    '<h2>Start from core</h2><p>Default to lean publishing and enable extra features only for clear use-cases.</p><h2>Recommended rollout</h2><ol><li>Publish with core and default theme.</li><li>Enable comments after moderation rules are ready.</li><li>Enable newsletter after provider and templates are configured.</li></ol><p>This keeps complexity proportional to your content operation.</p>',
    'How to roll out comments, AI helpers, and newsletter features without overcomplicating day one.',
    (SELECT id FROM authors WHERE email = 'hello@example.com'),
    '850e8400-e29b-41d4-a716-446655440001',
    'published',
    NOW() - INTERVAL '2 days',
    '{"metaTitle": "Modular editorial workflow", "metaDescription": "A staged approach to enabling AdAstro feature modules while preserving a lean core experience."}'::jsonb
  ),
  (
    '950e8400-e29b-41d4-a716-446655440034',
    'From prototype to production: what changed in AdAstro setup',
    'prototype-to-production-setup',
    'en',
    '<h2>Setup flow matters</h2><p>Production setup now prioritizes clear prerequisites, automated checks, and fewer hidden assumptions.</p><h2>Key upgrades</h2><ul><li>Stricter setup gating</li><li>Improved environment validation</li><li>Better defaults for content and navigation</li></ul><p>Small reliability improvements add up quickly once content volume grows.</p>',
    'What changed between early builds and production-ready setup, and why those changes matter.',
    (SELECT id FROM authors WHERE email = 'hello@example.com'),
    '850e8400-e29b-41d4-a716-446655440002',
    'published',
    NOW() - INTERVAL '1 day',
    '{"metaTitle": "AdAstro setup from prototype to production", "metaDescription": "A look at setup and reliability improvements that moved AdAstro toward a stable release."}'::jsonb
  )
ON CONFLICT (locale, slug) DO UPDATE
SET title = EXCLUDED.title,
    content = EXCLUDED.content,
    excerpt = EXCLUDED.excerpt,
    author_id = EXCLUDED.author_id,
    featured_image_id = EXCLUDED.featured_image_id,
    status = EXCLUDED.status,
    published_at = EXCLUDED.published_at,
    seo_metadata = EXCLUDED.seo_metadata,
    updated_at = NOW();

-- Insert editable system pages
INSERT INTO pages (
  id,
  title,
  slug,
  locale,
  status,
  template,
  excerpt,
  author_id,
  seo_metadata,
  published_at
) VALUES
  (
    'a20e8400-e29b-41d4-a716-446655440001',
    'Home',
    'home',
    'en',
    'published',
    'landing',
    'AdAstro overview and release-ready defaults.',
    (SELECT id FROM authors WHERE email = 'hello@example.com'),
    '{"metaTitle":"AdAstro - The lightspeed CMS","metaDescription":"Fast-by-default CMS with modular AI, comments, and newsletter features."}'::jsonb,
    NOW() - INTERVAL '3 days'
  ),
  (
    'a20e8400-e29b-41d4-a716-446655440002',
    'Articles',
    'blog',
    'en',
    'published',
    'content',
    'Latest articles and release notes.',
    (SELECT id FROM authors WHERE email = 'hello@example.com'),
    '{"metaTitle":"AdAstro Articles","metaDescription":"Publishing updates, product notes, and practical CMS guides."}'::jsonb,
    NOW() - INTERVAL '2 days'
  ),
  (
    'a20e8400-e29b-41d4-a716-446655440003',
    'About',
    'about',
    'en',
    'published',
    'content',
    'What AdAstro is and how to use it.',
    (SELECT id FROM authors WHERE email = 'hello@example.com'),
    '{"metaTitle":"About AdAstro","metaDescription":"A practical CMS focused on speed, control, and modular features."}'::jsonb,
    NOW() - INTERVAL '2 days'
  ),
  (
    'a20e8400-e29b-41d4-a716-446655440004',
    'Contact',
    'contact',
    'en',
    'published',
    'content',
    'Where users can reach maintainers and contributors.',
    (SELECT id FROM authors WHERE email = 'hello@example.com'),
    '{"metaTitle":"Contact AdAstro","metaDescription":"Support and collaboration channels for the AdAstro project."}'::jsonb,
    NOW() - INTERVAL '1 day'
  )
ON CONFLICT (locale, slug) DO UPDATE
SET title = EXCLUDED.title,
    status = EXCLUDED.status,
    template = EXCLUDED.template,
    excerpt = EXCLUDED.excerpt,
    author_id = EXCLUDED.author_id,
    seo_metadata = EXCLUDED.seo_metadata,
    published_at = EXCLUDED.published_at,
    updated_at = NOW();

-- Keep page sections deterministic between seed runs
DELETE FROM page_sections ps
USING pages p
WHERE ps.page_id = p.id
  AND p.slug IN ('home', 'blog', 'about', 'contact')
  AND p.locale = 'en';

INSERT INTO page_sections (id, page_id, type, content, order_index) VALUES
  (
    'b20e8400-e29b-41d4-a716-446655440101',
    (SELECT id FROM pages WHERE slug = 'home' AND locale = 'en' LIMIT 1),
    'hero',
    '{"label":"AdAstro","heading":"AdAstro - The lightspeed CMS","subheading":"A practical CMS focused on clean defaults, speed, and modular features you can turn on only when needed.","primaryCtaLabel":"Read articles","primaryCtaHref":"/blog","secondaryCtaLabel":"Open admin","secondaryCtaHref":"/admin","imageUrl":"/images/adastro.webp","imageAlt":"AdAstro launch illustration"}'::jsonb,
    0
  ),
  (
    'b20e8400-e29b-41d4-a716-446655440102',
    (SELECT id FROM pages WHERE slug = 'home' AND locale = 'en' LIMIT 1),
    'feature_grid',
    '{"heading":"What ships in core","subtitle":"Lean defaults for fast sites and simple publishing.","items":[{"badge":"Performance","title":"Fast by default","description":"Minimal JavaScript, optimized rendering, and predictable templates."},{"badge":"Security","title":"Supabase-first auth","description":"Server-side guarded admin routes and secure-by-default setup checks."},{"badge":"Modular","title":"Optional features","description":"AI, comments, and newsletter are bundled but disabled until you activate them."}]}'::jsonb,
    1
  ),
  (
    'b20e8400-e29b-41d4-a716-446655440103',
    (SELECT id FROM pages WHERE slug = 'home' AND locale = 'en' LIMIT 1),
    'cta',
    '{"heading":"Ready to publish","body":"Use the Articles page for content and keep Home focused on your product message.","ctaLabel":"Go to Articles","ctaHref":"/blog"}'::jsonb,
    2
  ),
  (
    'b20e8400-e29b-41d4-a716-446655440201',
    (SELECT id FROM pages WHERE slug = 'blog' AND locale = 'en' LIMIT 1),
    'hero',
    '{"label":"Content","heading":"Articles","subheading":"Publishing updates, practical guides, and release notes.","primaryCtaLabel":"Contact us","primaryCtaHref":"/contact"}'::jsonb,
    0
  ),
  (
    'b20e8400-e29b-41d4-a716-446655440301',
    (SELECT id FROM pages WHERE slug = 'about' AND locale = 'en' LIMIT 1),
    'hero',
    '{"label":"About","heading":"Built to stay fast over time","subheading":"AdAstro started as a practical response to slow, plugin-heavy CMS stacks. The goal is simple: keep publishing predictable, fast, and maintainable.","imageUrl":"/images/adastro.webp","imageAlt":"AdAstro project illustration"}'::jsonb,
    0
  ),
  (
    'b20e8400-e29b-41d4-a716-446655440302',
    (SELECT id FROM pages WHERE slug = 'about' AND locale = 'en' LIMIT 1),
    'info_blocks',
    '{"heading":"How to work with AdAstro","subtitle":"The release flow is intentionally simple and built around progressive adoption.","items":[{"title":"Start with core","description":"Run core SQL, complete setup, and confirm your public routes and menus."},{"title":"Turn on features deliberately","description":"Activate AI, comments, and newsletter only when process and moderation are ready."},{"title":"Ship without plugin sprawl","description":"Most production setups can stay lean while still hitting high performance scores."}]}'::jsonb,
    1
  ),
  (
    'b20e8400-e29b-41d4-a716-446655440303',
    (SELECT id FROM pages WHERE slug = 'about' AND locale = 'en' LIMIT 1),
    'feature_grid',
    '{"heading":"What is included","subtitle":"Everything here is editable from the admin UI.","items":[{"badge":"Core","title":"Pages, posts, media, users","description":"A complete publishing core with setup flow, themes, and secure admin access."},{"badge":"Performance","title":"PageSpeed-first defaults","description":"Lean templates, reduced client JS, and a predictable rendering model."},{"badge":"Modular","title":"Optional feature packs","description":"AI, comments, and newsletter ship with core but stay inactive until enabled."}]}'::jsonb,
    2
  ),
  (
    'b20e8400-e29b-41d4-a716-446655440304',
    (SELECT id FROM pages WHERE slug = 'about' AND locale = 'en' LIMIT 1),
    'cta',
    '{"heading":"Want to customize it further?","body":"Use the page editor, theme manager, and feature framework to adapt AdAstro for your own publishing workflow.","ctaLabel":"Open documentation","ctaHref":"https://github.com/burconsult/adastro"}'::jsonb,
    3
  ),
  (
    'b20e8400-e29b-41d4-a716-446655440401',
    (SELECT id FROM pages WHERE slug = 'contact' AND locale = 'en' LIMIT 1),
    'hero',
    '{"label":"Contact","heading":"Questions or collaboration ideas","subheading":"Use this page for support links, roadmap feedback, or contributor outreach.","primaryCtaLabel":"Open GitHub Issues","primaryCtaHref":"https://github.com/burconsult/adastro/issues","secondaryCtaLabel":"Discussions","secondaryCtaHref":"https://github.com/burconsult/adastro/discussions","imageUrl":"/images/adastro.webp","imageAlt":"Support desk illustration"}'::jsonb,
    0
  ),
  (
    'b20e8400-e29b-41d4-a716-446655440402',
    (SELECT id FROM pages WHERE slug = 'contact' AND locale = 'en' LIMIT 1),
    'cta',
    '{"heading":"Update this page from the editor","body":"Everything here is editable from Admin -> Pages with no code changes required.","ctaLabel":"Open pages","ctaHref":"/admin/pages"}'::jsonb,
    1
  );

-- Link posts to categories
INSERT INTO post_categories (post_id, category_id)
SELECT p.id, c.id
FROM (
  VALUES
    ('pagespeed-90-without-plugins', 'performance'),
    ('pagespeed-90-without-plugins', 'seo'),
    ('pagespeed-90-without-plugins', 'open-source'),
    ('ai-seo-autopilot-nano-banana', 'seo'),
    ('ai-seo-autopilot-nano-banana', 'ai'),
    ('release-checklist-clean-launch', 'performance'),
    ('release-checklist-clean-launch', 'open-source'),
    ('editorial-workflow-modular-features', 'seo'),
    ('editorial-workflow-modular-features', 'ai'),
    ('prototype-to-production-setup', 'performance'),
    ('prototype-to-production-setup', 'seo')
) AS links(post_slug, category_slug)
JOIN posts p ON p.slug = links.post_slug AND p.locale = 'en'
JOIN categories c ON c.slug = links.category_slug
ON CONFLICT DO NOTHING;

-- Link posts to tags
INSERT INTO post_tags (post_id, tag_id)
SELECT p.id, t.id
FROM (
  VALUES
    ('pagespeed-90-without-plugins', 'astro'),
    ('pagespeed-90-without-plugins', 'pagespeed-insights'),
    ('pagespeed-90-without-plugins', 'core-web-vitals'),
    ('pagespeed-90-without-plugins', 'open-source'),
    ('ai-seo-autopilot-nano-banana', 'ai'),
    ('ai-seo-autopilot-nano-banana', 'seo-automation'),
    ('ai-seo-autopilot-nano-banana', 'nano-banana'),
    ('release-checklist-clean-launch', 'astro'),
    ('release-checklist-clean-launch', 'core-web-vitals'),
    ('editorial-workflow-modular-features', 'ai'),
    ('editorial-workflow-modular-features', 'seo-automation'),
    ('prototype-to-production-setup', 'pagespeed-insights'),
    ('prototype-to-production-setup', 'open-source')
) AS links(post_slug, tag_slug)
JOIN posts p ON p.slug = links.post_slug AND p.locale = 'en'
JOIN tags t ON t.slug = links.tag_slug
ON CONFLICT DO NOTHING;

-- Seed v1 settings defaults/overrides used by the demo content and footer UI.
-- Core SQL remains the source of truth for the full settings schema.
INSERT INTO site_settings (key, value, category, description)
VALUES
  (
    'content.defaultLocale',
    to_jsonb('en'::text),
    'content',
    'Default locale for public routes and localized content resolution.'
  ),
  (
    'content.locales',
    '["en"]'::jsonb,
    'content',
    'Enabled public locales in URL prefix order (default locale first).'
  ),
  (
    'site.titleByLocale',
    '{}'::jsonb,
    'general',
    'Optional locale-specific site titles keyed by locale code.'
  ),
  (
    'site.descriptionByLocale',
    '{}'::jsonb,
    'general',
    'Optional locale-specific site descriptions keyed by locale code.'
  ),
  (
    'site.taglineByLocale',
    '{}'::jsonb,
    'general',
    'Optional locale-specific taglines keyed by locale code.'
  ),
  (
    'content.categoryLabelsByLocale',
    '{}'::jsonb,
    'content',
    'Optional localized category labels keyed by category slug, then locale code.'
  ),
  (
    'content.categoryDescriptionsByLocale',
    '{}'::jsonb,
    'content',
    'Optional localized category descriptions keyed by category slug, then locale code.'
  ),
  (
    'content.tagLabelsByLocale',
    '{}'::jsonb,
    'content',
    'Optional localized tag labels keyed by tag slug, then locale code.'
  ),
  (
    'navigation.footerAttribution',
    to_jsonb('Powered by AdAstro'::text),
    'navigation',
    'Text shown in the footer powered-by line.'
  ),
  (
    'navigation.footerAttributionUrl',
    to_jsonb('https://github.com/burconsult/adastro'::text),
    'navigation',
    'Link target for the footer powered-by line.'
  ),
  (
    'social.github',
    to_jsonb('https://github.com/burconsult/adastro'::text),
    'social',
    'GitHub profile or project URL shown in the footer Connect section.'
  ),
  (
    'analytics.enabled',
    'true'::jsonb,
    'general',
    'Track lightweight first-party page views for the built-in analytics dashboard.'
  )
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    updated_at = NOW();
