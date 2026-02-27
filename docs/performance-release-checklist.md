# Performance Release Checklist (PSI 90+)

Use this checklist before tagging a public release.

## 1) Test Against Production-Like Data
- Seed realistic content (post count, hero images, embeds).
- Use optimized media assets for featured images.
- Disable development tooling and test a production deployment.

## 2) Run Lighthouse Locally
- Build + preview:
  - `npm run build`
  - `npm run preview`
- Run Lighthouse for:
  - `/`
  - articles index (`/blog` or your configured base path)
  - one article detail page
- Target:
  - Performance >= 90 (mobile)
  - Accessibility >= 90
  - Best Practices >= 90
  - SEO >= 90

## 3) Run PageSpeed Insights in Region
- Test your live deployment URL in [PageSpeed Insights](https://pagespeed.web.dev/).
- Validate mobile score on:
  - homepage
  - article index
  - article detail
- Compare with Lighthouse; treat regressions as blockers.

## 4) Core Web Vitals Guardrails
- LCP: keep hero assets small and pre-optimized.
- CLS: reserve dimensions for media and embeds.
- INP: avoid heavy client-side scripts on public pages.
- TTFB: verify adapter caching and Supabase latency.

## 5) Common Fixes if Score Drops
- Compress/resize hero images; avoid oversized PNG/JPEG.
- Remove unused third-party scripts.
- Move runtime scripts to same-origin static files (avoid `data:` script URLs).
- Re-test after each change and keep a short changelog of score deltas.

## 6) Suggested Release Gate
- Do not ship if any key public route is below 90 mobile performance after remediation attempts.
- If unavoidable, document the known bottleneck and mitigation plan in the release notes.
