# AI-Assisted Coding Lessons From AdAstro

> Historical engineering retrospective. Use `docs/architecture/`, `AGENTS.md`, and `docs/engineering/local-testing.md` for current project rules.

This document is a project-specific retrospective on what actually worked and did not work while using AI to build and harden AdAstro.

It is not a generic prompt guide. The useful parts came from shaping the repository so AI had fewer ways to make damaging guesses.

## 1. Project Context

AdAstro is a good AI-assisted coding case study because it combines several surfaces that are easy for AI to get wrong unless the repo is explicit:
- Astro SSR + React admin UI.
- Supabase Auth, Postgres, Storage, and RLS.
- A setup wizard with a deliberate trust boundary.
- Optional modular features (`ai`, `comments`, `newsletter`).
- Provider integrations and deployment differences across Vercel and Netlify.
- A mix of content, admin, infra, and security-sensitive code.

The repo ended up needing strong structure because "just ask the AI to make the change" was not reliable enough on its own.

## 2. The Main Lesson

AI became materially more useful once the repository encoded the rules that a senior engineer would otherwise keep in their head.

The pattern that worked was:
1. Write down the architecture and contracts.
2. Make dangerous areas fail closed.
3. Give AI a deterministic local validation path.
4. Require docs updates alongside code changes.
5. Keep tasks bounded enough that verification is cheaper than debate.

Without those conditions, AI could still move quickly, but it drifted faster than the codebase could absorb.

## 3. What Worked Well

### 3.1 Architecture maps made the AI much better

The most important repo investment was explicit orientation material:
- `docs/architecture/system-map.md`
- `docs/architecture/contracts.md`
- `docs/architecture/boundaries.md`
- `docs/architecture/data-ownership.md`
- `docs/architecture/map.json`

What this changed in practice:
- The AI stopped inventing request flow and ownership boundaries from folder names alone.
- Cross-cutting changes became easier to scope before editing.
- It became practical to say "stay inside this boundary" and have that mean something concrete.

`docs/architecture/map.json` is especially useful because it gives AI tooling a machine-readable index of the system instead of forcing it to infer the whole repo from ad hoc searches.

### 3.2 Contracts beat conventions

AI follows conventions inconsistently. It follows explicit contracts much better.

Examples in this repo:
- `src/pages/api/features/[feature]/[action].ts` is the central feature dispatcher.
- `features.<id>.enabled` is the activation invariant.
- `/api/setup/complete` is the only path allowed to release setup gate.
- `/mcp` has a specific auth and fail-closed contract.
- Settings are registry-owned rather than written ad hoc.

Once those rules were documented in `docs/architecture/contracts.md`, AI changes became much easier to review because we could ask one simple question: "Did this change honor the contract?"

### 3.3 Fail-closed defaults reduced the cost of AI mistakes

This repo got better as more sensitive surfaces were made hostile to accidental "helpful" behavior.

Patterns that worked:
- Feature APIs must reject requests when the feature is inactive.
- `/mcp` returns `503` when `MCP_SERVER_TOKEN` is not configured.
- Privileged server work requires `SUPABASE_SECRET_KEY`; client code only uses `SUPABASE_PUBLISHABLE_KEY`.
- Role resolution hardens toward `reader` instead of elevating accidentally.
- Setup completion is guarded by a single completion path instead of scattered toggles.

This is a major AI lesson: if a surface cannot fail closed, AI-generated regressions become much more expensive to detect.

### 3.4 Modular feature boundaries worked extremely well

AdAstro's bundled feature pattern is one of the clearest examples of AI-friendly structure:
- `src/lib/features/<feature-id>/`
- `index.ts`
- `server.ts`
- `settings.ts`
- `feature.json`
- optional `api.ts`, `mcp.ts`, admin/public UI, i18n packs

Why this worked:
- New feature work had a repeatable skeleton.
- The AI had fewer opportunities to smear logic across unrelated core files.
- Feature lifecycle thinking became explicit: install, enable, disable, uninstall, reinstall.

This pattern made AI much more reliable on feature work than on unbounded "add this capability anywhere it fits" requests.

### 3.5 Deterministic local verification was a force multiplier

The repo-supported validation commands mattered as much as the prompt quality:
- `npm run verify:quick`
- `npm run verify:full`
- `npm run verify:features`
- `npm run verify:content`
- `npm run ci:check-admin-consistency`
- `npm run ci:check-release-hygiene`

What worked:
- Fast commands for routine iteration.
- Broader commands before shipping.
- Specialized checks for the repo's real failure modes.

This was much better than relying on "run tests" as a vague instruction. AI performs better when the validation surface is already curated.

### 3.6 Documentation-in-the-same-change-set worked

One repeated success pattern was requiring docs to move with the code:
- `README.md`
- `INSTALLATION.md`
- `CHANGELOG.md`
- architecture docs
- feature docs

This did three useful things:
- It exposed when the implementation was still fuzzy.
- It forced the AI to reconcile user-facing behavior with code behavior.
- It created reusable context for future AI sessions.

In practice, asking for docs updates was not overhead. It was a quality filter.

### 3.7 Release gates converted AI speed into safer progress

The pair of:
- `docs/release-gates.md`
- `docs/release-execution-board.md`

turned "AI can do many things quickly" into "AI can advance one verified gate at a time."

That worked well because it reduced a vague release problem into:
- current gate,
- evidence required,
- fix strategy,
- verification,
- exit criteria.

AI is much more dependable when the task looks like a checklist with evidence instead of an open-ended release narrative.

### 3.8 Human review stayed focused when the review targets were explicit

The existing playbook got this right. Human review was most useful when narrowed to:
- boundary violations,
- security regressions,
- setup and deploy regressions,
- data ownership mistakes,
- inactive-feature leakage.

That is a better use of human time than rereading every line as though the AI were a junior autocomplete engine.

## 4. What Worked, But Only With Constraints

### 4.1 AI was good at first drafts for documentation and internal tools

AI was consistently helpful for:
- initial docs structure,
- release checklists,
- admin consistency checks,
- repetitive wiring across modular features,
- test scaffolding,
- refactors once the destination shape was already decided.

This only worked when the target shape was already constrained by the repo.

### 4.2 AI was useful on security-sensitive areas only after the repo defined the safety rails

Auth, setup, admin, storage, and migration code are all high-risk surfaces here.

AI could still help there, but only after the repository encoded rules such as:
- keep secret-bearing logic server-only,
- preserve the `admin` / `author` / `reader` role model,
- use upgrade migrations for shipped schema changes,
- do not expose inactive features,
- keep setup as a manual trust boundary where required.

The lesson is not "do not use AI in security-sensitive code." The real lesson is "do not let the AI invent the security model."

### 4.3 AI handled provider integrations better once providers were catalogued centrally

The AI feature architecture improved because provider/model decisions were not scattered:
- `src/lib/features/ai/lib/provider-registry.ts`
- `src/lib/features/ai/lib/provider-catalog.ts`
- `src/lib/features/ai/lib/model-registry.ts`

Once those registries existed:
- adding or changing providers became a bounded task,
- model defaults were easier to review,
- AI stopped hardcoding capability assumptions in random places.

### 4.4 AI was effective on repetitive UI and route consistency checks

The repo has specialized checks because drift across many admin routes is exactly the kind of problem AI can introduce while moving quickly.

The combination of:
- explicit admin patterns,
- a consistency checker,
- tests,
- architecture docs

made AI-generated UI work more reliable than ad hoc manual tweaking.

## 5. What Did Not Work

### 5.1 Vague prompts produced architecture drift

Prompts like these were poor:
- "clean this up"
- "modernize the admin"
- "make the setup flow better"
- "improve the AI feature"
- "simplify routing"

Those prompts sound reasonable, but in this repo they encourage:
- boundary violations,
- hidden behavior changes,
- undocumented settings changes,
- accidental security regressions,
- broad diffs that are expensive to review.

The better prompt shape was the one captured in `docs/engineering/ai-collab-playbook.md`:
1. objective,
2. constraints,
3. boundaries not to cross,
4. acceptance criteria,
5. likely files or surfaces.

### 5.2 Broad refactor plus behavior change in one pass did not work well

AI is happy to combine:
- naming cleanup,
- file moves,
- API behavior changes,
- test rewrites,
- docs rewrites

into one large, "coherent" diff.

That usually reads well and reviews badly.

In AdAstro, the safer pattern was:
- stabilize contracts first,
- refactor shape second,
- change behavior third,
- update docs in the same PR,
- verify after each meaningful step.

### 5.3 Silent schema and settings changes were a recurring risk

Two specific failure modes were common enough to turn into rules:
- the AI would invent or ad hoc write settings keys,
- the AI would treat schema changes as local implementation details rather than repository-wide compatibility changes.

What fixed this:
- registry-owned settings definitions,
- data ownership docs,
- upgrade migrations under `infra/supabase/migrations/`,
- explicit baseline-vs-upgrade SQL policy.

The general lesson is that AI needs the repository to declare which state is "owned" and how it is allowed to evolve.

### 5.4 Cross-boundary imports are an easy way for AI to make a mess

Without an explicit module boundary, AI will often import a convenient internal helper from the wrong layer because it is locally efficient.

That looks harmless until:
- feature internals leak into core,
- setup logic appears in runtime code,
- server-only assumptions show up in client code,
- MCP or provider logic gets duplicated.

`docs/architecture/boundaries.md` exists because AI tends to optimize for immediate usefulness, not long-term seam quality.

### 5.5 AI will confidently automate steps that should stay manual

The setup flow is an important example. Some steps intentionally remain manual or externally verified:
- initial core schema bootstrap on hosted installs,
- provider dashboard configuration,
- redirect allow-list setup,
- secret handling,
- some hosted auth/storage trust boundaries.

If the repo does not state these limits explicitly, AI tends to over-automate and blur trust boundaries.

### 5.6 "Looks plausible" is not enough for provider usage and billing data

The AI feature architecture explicitly describes cost reporting as best-effort rather than provider-authoritative.

That is the right posture.

Without that guardrail, AI tends to:
- overstate what billing numbers mean,
- infer precision from incomplete provider metadata,
- present estimates as facts.

This was a broader lesson too: when the underlying system only knows an estimate, the code and docs should say so plainly.

### 5.7 Inactive-state bugs are easy for AI to create

One of the most persistent AI failure modes in modular systems is forgetting that "disabled" is a real runtime state.

That shows up as:
- visible admin affordances for inactive features,
- public routes or widgets rendering when they should not,
- MCP tools existing when a feature is disabled,
- API handlers assuming feature availability.

AdAstro improved a lot once inactive-state behavior became a first-class test and documentation concern instead of an afterthought.

## 6. Repo Shapes That Made AI More Reliable

The following repository shapes paid off repeatedly:

### 6.1 A map index for orientation

`docs/architecture/README.md` gives a stable starting point. This matters because AI sessions are stateless enough that rediscovering the entry points every time is wasteful.

### 6.2 One obvious place for each concern

Examples:
- feature settings live in `settings.ts`
- feature runtime wiring lives in `server.ts`
- feature metadata lives in `feature.json`
- setup completion has one API path
- provider metadata is centralized

The less "maybe it is here, maybe it is there" ambiguity existed, the more useful AI became.

### 6.3 Machine-checkable hygiene

The repo has specific checks for specific problems:
- admin consistency,
- theme tokens,
- release hygiene,
- feature lifecycle,
- default content coherence.

This is more effective than asking AI to "be careful."

### 6.4 Strong naming and folder conventions

The feature module layout, migration paths, docs layout, and route structure all reduced guesswork. AI benefits disproportionately from predictable names because search results become much easier to interpret.

### 6.5 Docs that describe invariants, not just intentions

The most valuable docs in AI-assisted work were not conceptual essays. They were docs that said:
- this is the only valid path,
- this state must fail closed,
- this layer owns these tables,
- these settings keys are canonical,
- these checks must pass before release.

AI handles concrete invariants better than abstract principles.

## 7. Prompting Patterns That Worked Best In Practice

The repo's short playbook is correct. The practical prompt template was:

1. Objective
2. Constraints
3. Boundaries not to cross
4. Acceptance criteria
5. Relevant files or surfaces

Example of a good request:

```md
Objective: add locale-aware narration outro defaults for the AI feature.
Constraints: no client-side secret exposure; preserve existing feature activation behavior.
Boundaries: do not change core routing, setup flow, or non-AI feature settings.
Acceptance criteria: admin settings can persist the values, inactive AI feature still fails closed, tests updated.
Surfaces: src/lib/features/ai/*, docs/architecture/ai-feature.md, README.md if behavior changes.
```

Why this worked:
- It told the AI what success looked like.
- It told the AI what not to "helpfully" redesign.
- It made validation obvious.

## 8. Working Model We Converged On

This is the operating model that seemed to scale best:

### 8.1 Orient first

Start with:
- `docs/architecture/system-map.md`
- `docs/architecture/contracts.md`
- `docs/architecture/boundaries.md`

### 8.2 Bound the change

Identify:
- affected routes,
- affected settings,
- affected tables,
- whether setup/auth/feature gates are involved,
- whether docs or release gates need updates.

### 8.3 Implement inside one boundary if possible

If a task crosses boundaries, make the crossing explicit and update the related contracts/docs in the same change.

### 8.4 Verify locally with the smallest relevant command first

Typical flow:
- targeted tests or repo-specific checker,
- `npm run verify:quick`,
- `npm run verify:full` for broader or release-sensitive changes.

### 8.5 Document before calling the task done

If the behavior changed, docs should reflect the new reality before the change is treated as complete.

### 8.6 Review the right things

Do not spend human review effort where automation already has high coverage. Spend it on:
- security model correctness,
- trust boundaries,
- boundary violations,
- data compatibility,
- deploy/setup realism.

## 9. Human Responsibilities That Did Not Go Away

AI helped a lot, but it did not remove the need for human ownership over:
- product tradeoffs,
- security posture,
- release decisions,
- infrastructure trust boundaries,
- wording that operators must actually follow,
- whether a change is worth the complexity it introduces.

This repo still benefited from a human deciding:
- which abstractions were justified,
- which tasks should be split,
- when to stop adding flexibility,
- when an AI-generated design was technically coherent but strategically wrong.

## 10. Advice For Teams Wanting Similar Results

If another team wants AI-assisted coding to work on a repo like this, the order of operations matters.

Do this first:
- write architecture and contract docs,
- encode dangerous invariants as code and tests,
- create a fast local verification path,
- keep state ownership explicit,
- make docs part of the delivery contract.

Then do this:
- give AI bounded tasks,
- require acceptance criteria,
- keep changes reviewable,
- maintain release gates with evidence.

Do not do this:
- rely on memory as the architecture source of truth,
- let AI invent new settings and schema conventions,
- ask for sweeping cleanup without boundaries,
- accept "plausible" on auth, setup, migration, or billing-related behavior,
- treat disabled states as unimportant.

## 11. Short Version For Presentation Use

If you need the condensed version for slides:

- AI helped most when the repo already knew its own rules.
- Contracts, boundaries, and fail-closed defaults mattered more than clever prompts.
- Deterministic local verification turned AI speed into something safe enough to ship.
- Modular feature architecture reduced cross-cutting damage.
- Documentation was not a byproduct; it was part of the control system.
- The worst results came from vague prompts, silent state changes, and broad unbounded refactors.
- Human review remained essential on security, setup, release, and architectural tradeoffs.

## 12. Related Repo Docs

- `docs/engineering/ai-collab-playbook.md`
- `docs/engineering/local-testing.md`
- `docs/architecture/README.md`
- `docs/architecture/system-map.md`
- `docs/architecture/contracts.md`
- `docs/architecture/boundaries.md`
- `docs/release-gates.md`
- `docs/release-execution-board.md`
- `docs/security.md`
