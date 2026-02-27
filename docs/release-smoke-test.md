# Release Smoke Test Matrix

Use this before tagging `v1.0.0`.
Execution state is tracked in `docs/release-execution-board.md` (primarily `G1`, `G3`, `G9`, `G10`).

## Targets
- Fresh Supabase + Vercel deployment
- Fresh Supabase + Netlify deployment

Run the same checks on both targets.

## A) Bootstrap
- [ ] Required environment variables are set in host (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`; `SITE_URL` recommended).
- [ ] Host redeployed after env changes.
- [ ] `/setup` Step 2 Core Schema SQL executed successfully in Supabase SQL Editor.
- [ ] `/setup` Step 3 Automated Setup completed (defaults, buckets, admin bootstrap).
- [ ] `/setup` reports no blocking checks.

## B) Auth + Admin
- [ ] Admin user exists with `app_metadata.role = admin`.
- [ ] Login works at `/auth/login`.
- [ ] `/admin` loads without CSP/script errors in browser console.

## C) Core CMS
- [ ] Homepage renders with expected theme and navigation.
- [ ] Create + publish a post.
- [ ] Article index route resolves using configured `content.articleBasePath`.
- [ ] Article permalink style works (`segment` or `wordpress`) and canonical URL is correct.
- [ ] Create + publish a page in the page editor.

## D) Bundled Features (default off, optional on)
- [ ] `ai`: enable, verify provider/settings UI and at least one action path.
- [ ] `comments`: enable, submit comment, verify moderation queue + approval flow.
- [ ] `newsletter`: enable, test subscribe path + admin campaign draft path.
- [ ] Uninstall one feature with data retained.
- [ ] Reinstall the same feature package and confirm recovery.

## E) Media + Storage
- [ ] Upload image from admin media library.
- [ ] Confirm media renders on public page.
- [ ] Required buckets exist and permissions are correct.

## F) Performance + SEO Gate
- [ ] Lighthouse mobile >= 90 on `/`.
- [ ] Lighthouse mobile >= 90 on article index.
- [ ] Lighthouse mobile >= 90 on article detail.
- [ ] PSI mobile >= 90 on deployed URLs.
- [ ] Structured data + OG tags present on article detail.

## G) Final Release Hygiene
- [ ] `npm run test:run` passes.
- [ ] `npm run build` passes.
- [ ] No untracked release artifacts (local scratch dirs ignored).
- [ ] Changelog/release notes reflect migration path and known limitations.
