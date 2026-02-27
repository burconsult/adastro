# Settings Coverage (Core)

This document tracks which core settings from `src/lib/settings/core-definitions.ts` are currently wired to runtime behavior.

## Fully Wired Categories

- `general`
  - `site.title`, `site.description`, `site.tagline`, `site.logoUrl`, `site.url`, `setup.allowReentry`
- `security`
  - `security.recaptcha.enabled`, `security.recaptcha.siteKey`, `security.recaptcha.secretKey`, `security.recaptcha.minScore`
- `navigation`
  - `navigation.topLinks`, `navigation.bottomLinks`, `navigation.footerAttribution`, `navigation.footerAttributionUrl`
- `seo`
  - `seo.defaultTitle`, `seo.defaultDescription`, `seo.keywords`, `seo.ogImage`
- `content`
  - `content.articleBasePath`, `content.articlePermalinkStyle`, `content.postsPerPage`, `content.excerptLength`
- `social`
  - `social.twitter`, `social.facebook`, `social.linkedin`, `social.github`, `social.links`
- `editor`
  - `editor.blocks.enabled`

## Notes

- Unimplemented `performance.*` keys were removed from the core settings registry for v1.0.0 to avoid exposing non-functional controls in admin.
