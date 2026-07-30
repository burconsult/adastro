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
- `video` (reserved in the contract; not currently implemented)

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
- Reporting stays feature-local inside `src/lib/features/ai/lib/usage.ts` plus `src/lib/features/ai/lib/pricing.ts`.
- Reporting returns request/token rollups by day, capability, operation, provider, and model.
- Cost reporting is best-effort rather than provider-authoritative:
  - exact where token usage and stable per-token pricing are available
  - estimated where only image metadata or inferred text-token counts exist
  - range-based where pricing depends on provider plan or unrecorded output quality
  - unpriced where the provider/runtime does not expose enough data

## Settings Shape
- Master toggle: `features.ai.enabled`
- Config version: `features.ai.configVersion`
- Tool toggles:
  - `features.ai.tools.seo.enabled`
  - `features.ai.tools.image.enabled`
  - `features.ai.tools.audio.enabled`
  - `features.ai.tools.alt.enabled`
- Capability defaults:
  - `features.ai.capabilities.text.defaultProvider`
  - `features.ai.capabilities.text.defaultModel`
  - `features.ai.capabilities.text.mediaAnalysisProvider`
  - `features.ai.capabilities.text.mediaAnalysisModel`
  - `features.ai.capabilities.image.defaultProvider`
  - `features.ai.capabilities.image.defaultModel`
  - `features.ai.capabilities.audio.defaultProvider`
  - `features.ai.capabilities.audio.defaultModel`
  - `features.ai.capabilities.audio.defaultVoice`
- Locale-aware narration templates:
  - `features.ai.audio.narrationIntroByLocale`
  - `features.ai.audio.narrationOutroByLocale`
- A one-time server-side upgrader maps the legacy AI keys into this shape on first AI access.

## Current CMS AI Surfaces
- Draft assist in post editor for title, excerpt, slug, category, tag, and SEO suggestions.
- Editorial QA in post editor with warning-only heuristics plus AI review notes.
- SEO metadata generation in post editor.
- Featured image generation in post editor + prompt-derived alt text for AI-generated images.
- Manual AI alt-text generation for uploaded images in media library using a dedicated media-analysis model.
- Audio narration generation in post editor with locale-aware intro/outro templates.
- Custom public audio player for narrated posts with seek and playback-speed controls.

## Near-Term Expansion Targets
- Content transformation: summarize/expand/rewrite blocks.
- Media assist: theme-aware image style presets and richer image analysis beyond alt text.
- Editorial QA: broken-link checks, deeper readability/style hints, and optional publish gating.
- Conversational site assistant: likely a separate feature module rather than an extension of AI Suite, especially if it grows into public widget deployment, knowledge-base sync, client tools, and MCP-backed operations.
