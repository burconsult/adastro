# AI Feature Architecture

## Goal
Keep AI modular and easy to extend while staying safe-by-default for a 1.0 release.

## Runtime Entry Points
- Feature module: `src/lib/features/ai/index.ts`
- API handlers: `src/lib/features/ai/api.ts` via `/api/features/ai/[action]`
- Capability/runtime config: `src/lib/features/ai/lib/config-service.ts`
- Provider registry: `src/lib/features/ai/lib/provider-registry.ts`
- Provider/capability catalog: `src/lib/features/ai/lib/provider-catalog.ts`
- Model registry (pinned defaults): `src/lib/features/ai/lib/model-registry.ts`
- Usage caps/reporting: `src/lib/features/ai/lib/usage.ts`

## Capability Model
The AI layer is capability-first:
- `text`
- `image`
- `audio`
- `video` (reserved in contract; not implemented in 1.0)

Providers declare capability support and implementation status in one registry, so adding a provider is mostly:
- a provider descriptor
- an optional discovery adapter
- one or more capability executors

## Provider Model Discovery
- Built-in model registry remains the canonical fallback.
- Optional remote discovery is available through provider APIs and Gateway endpoints.
- Vercel AI Gateway is the default text and image provider on new installs.
- ElevenLabs is the default audio provider on new installs.
- Different modalities can use different providers and models at the same time.
- Admin/API can request fresh model discovery without changing stored settings.
- Pricing links are kept in provider metadata (no hard dependency on external pricing APIs).

## Usage Caps and Reporting
- Feature-owned table: `public.ai_usage_events`
- Migration: `src/lib/features/ai/migrations/000_ai_usage.sql`
- Uninstall cleanup: `src/lib/features/ai/uninstall.sql`
- Caps are simple per-user daily request limits:
  - `features.ai.limits.seoDailyRequests`
  - `features.ai.limits.imageDailyRequests`
  - `features.ai.limits.audioDailyRequests`
- Reporting returns request/token rollups by day, capability, and provider.

## Settings Shape
- Master toggle: `features.ai.enabled`
- Config version: `features.ai.configVersion`
- Tool toggles:
  - `features.ai.tools.seo.enabled`
  - `features.ai.tools.image.enabled`
  - `features.ai.tools.audio.enabled`
- Capability defaults:
  - `features.ai.capabilities.text.defaultProvider`
  - `features.ai.capabilities.text.defaultModel`
  - `features.ai.capabilities.image.defaultProvider`
  - `features.ai.capabilities.image.defaultModel`
  - `features.ai.capabilities.audio.defaultProvider`
  - `features.ai.capabilities.audio.defaultModel`
  - `features.ai.capabilities.audio.defaultVoice`
- A one-time server-side upgrader maps the legacy AI keys into this shape on first AI access.

## Current CMS AI Surfaces
- SEO metadata generation in post editor.
- Featured image generation in post editor + media library.
- Audio narration generation in post editor.

## Near-Term Expansion Targets
- Draft assist: title/excerpt/tag suggestions.
- Content transformation: summarize/expand/rewrite blocks.
- Media assist: auto alt-text and image style presets per theme.
- Editorial QA: pre-publish checks (SEO length, broken links, readability hints).
