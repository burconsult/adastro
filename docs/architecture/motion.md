# Motion Library Notes

Adastro already ships with React islands, so a motion library can be added
without affecting the static marketing pages. Recommended options:

## Framer Motion (full-featured)
- Best for complex UI interactions and spring-based animations.
- Works inside React islands (admin UI, interactive widgets).
- Requires adding `framer-motion` to dependencies.

## Motion One (lighter)
- Smaller footprint, great for simple entrance transitions.
- Can be used in both Astro and React components.
- Requires adding `@motionone/dom` or `@motionone/solid`.

## Suggested Integration Pattern
1. Add the dependency to `package.json`.
2. Wrap animations inside React islands only (admin settings, theme previews).
3. Respect `prefers-reduced-motion` and disable transitions when set.
4. Keep global CSS animations minimal to avoid CLS on the public site.
