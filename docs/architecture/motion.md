# Motion Contract

AdAstro uses `framer-motion` for selected React islands and CSS transitions for lightweight public interactions.

## Current Surfaces

- `src/components/motion/ErrorMascot.tsx` animates error-page artwork.
- `src/lib/components/FeatureManager.tsx` animates feature cards and state changes.
- `src/lib/components/ThemeManager.tsx` animates theme previews and selections.
- `src/styles/global.css` supplies reduced-motion fallbacks for global transitions.

## Rules

1. Respect `prefers-reduced-motion`; use `useReducedMotion()` in Framer Motion components.
2. Keep animation inside hydrated islands. Do not hydrate otherwise static public pages solely for decoration.
3. Avoid layout-shifting animation properties on public content.
4. Keep functional state and accessibility independent of animation completion.
5. Add focused tests when motion changes interaction state or visibility.

Use CSS transitions for simple hover/focus feedback. Use Framer Motion when an island needs coordinated state transitions, presence, or spring behavior.
