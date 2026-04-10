# English Site Copy Refresh

Date: 2026-04-10

This draft is based on the live English content pulled from the production Supabase project plus the current repository state in `README.md` and `CHANGELOG.md`.

## Recommended Content Split

- Home: concise product positioning, proof points, and next-step CTAs.
- About: why AdAstro exists, what it optimizes for, what stays optional, and who should use it.
- Articles index: a short editorial promise for the article library.
- Contact: support and collaboration routes only.
- Posts: topic-specific depth. Each post should explain one part of the product without re-explaining the full stack.

## Overlap To Remove From The Live English Site

- Home and About both currently explain the core feature set, rollout path, performance stance, and MCP support.
- The current Welcome article repeats the same stack summary already shown on Home and About.
- The current AI and performance articles are too short to justify being separate articles, so they read like duplicate teaser copy rather than actual depth.
- Contact is still placeholder-level and should stop talking about page editing.

## Canonical Ownership By Surface

- Home owns: product positioning, quick proof points, and primary CTAs.
- About owns: philosophy, scope, what AdAstro is and is not, and the maintenance model.
- Welcome article owns: evaluation-oriented orientation for new readers.
- Editorial workflow article owns: the phased rollout model for optional features.
- Why I Built This owns: founder story and the AI-assisted build context.
- AI workflows article owns: how AI is used, reviewed, and governed.
- Performance article owns: why the public site stays fast as content grows.
- Contact owns: where to go for bugs, questions, and collaboration.

## Slug And Redirect Recommendations

- Keep: `welcome-to-adastro`
- Keep: `editorial-workflow-modular-features`
- Keep: `why-i-built-this`
- Change `ai-seo-autopilot-nano-banana` to `adastro-ai-workflows` and add a redirect from the old slug.
- Change `pagespeed-90-without-plugins` to `how-adastro-stays-fast` and add a redirect from the old slug.

## Pages

### Home

Path: `/en`

SEO title: `AdAstro | A speed-first CMS you can actually own`

Meta description: `AdAstro is a forkable Astro and Supabase CMS with a strong core, optional feature packs, multilingual publishing, WordPress migration, and hosted deployment paths for Vercel or Netlify.`

Excerpt: `AdAstro is a practical publishing stack with fast public pages, a clean admin workspace, and optional features you can turn on only when your workflow is ready.`

Hero

- Label: `AdAstro`
- Heading: `A speed-first CMS you can actually own`
- Subheading: `AdAstro combines Astro, React, and Supabase into a forkable publishing stack with fast public pages, a clean admin workspace, multilingual routing, WordPress migration tooling, and optional feature packs for AI, comments, and newsletters.`
- Primary CTA label: `Read the articles`
- Primary CTA href: `/articles`
- Secondary CTA label: `View repository`
- Secondary CTA href: `https://github.com/burconsult/adastro`

Feature grid

- Heading: `What makes AdAstro different`
- Subtitle: `The product starts with a strong publishing core and adds complexity only when there is a real editorial reason to do it.`
- Item 1 title: `Fast public pages by default`
- Item 1 badge: `Performance`
- Item 1 description: `Astro server rendering, low-JS public routes, lean templates, SEO defaults, and practical release checks keep the public experience fast without relying on a plugin pile.`
- Item 2 title: `A core you can understand`
- Item 2 badge: `Core CMS`
- Item 2 description: `Posts, pages, media, themes, SEO, settings, users, and localization live inside one coherent stack instead of being scattered across add-ons and vendor dashboards.`
- Item 3 title: `Optional features, not mandatory sprawl`
- Item 3 badge: `Modular`
- Item 3 description: `AI, comments, and newsletter capabilities ship with the repo but stay inactive until you decide your workflow, moderation model, and ownership are ready.`

Info blocks

- Heading: `Built for real publishing teams`
- Subtitle: `AdAstro is designed for teams that want operational clarity as much as feature breadth.`
- Item 1 title: `Migrate from WordPress carefully`
- Item 1 badge: `Migration`
- Item 1 description: `Import WXR exports with trial runs, progress streaming, artifact tracking, and rollback-friendly workflows before you commit to a full move.`
- Item 2 title: `Publish in multiple locales`
- Item 2 badge: `Localization`
- Item 2 description: `Public routes are locale-first, localized variants stay linked, and the system ships with English, Norwegian Bokmal, Spanish, and Chinese language packs out of the box.`
- Item 3 title: `Automate without losing control`
- Item 3 badge: `Automation`
- Item 3 description: `AdAstro can expose an authenticated MCP endpoint for safe publishing and admin workflows, while keeping secrets and privileged actions on the server side.`

CTA

- Heading: `Explore the product from three angles`
- Body: `Start with the article library for focused product notes, open About for the design philosophy, or go straight to the repository if you want the implementation details.`
- CTA label: `Read the articles`
- CTA href: `/articles`

### About

Path: `/en/about`

SEO title: `About AdAstro | Why it exists and how it is designed`

Meta description: `AdAstro is a lean Astro and Supabase CMS built to keep publishing predictable: a strong core, optional feature packs, multilingual routing, migration tools, and fail-closed operational boundaries.`

Excerpt: `AdAstro is a lean Astro and Supabase CMS built for predictable publishing, strong defaults, and deliberate feature rollout.`

Hero

- Label: `About AdAstro`
- Heading: `A lean CMS built to stay understandable`
- Subheading: `AdAstro exists for teams that want modern publishing infrastructure without the usual plugin sprawl, hidden coupling, or day-one feature overload. It starts with a solid core and grows in deliberate steps.`

Rich text

`AdAstro started from a simple question: what would a modern publishing stack look like if operational clarity mattered as much as features? The answer was not "add everything." It was to make the core strong enough that a team could launch with confidence before enabling more complex workflows.

That is why the base product focuses on posts, pages, reusable sections, media, SEO, themes, localization, setup guidance, and migration tooling. Those are the pieces most editorial teams need first. They also happen to be the parts that get harder to maintain when they are spread across disconnected plugins and external services.

The rest of the product follows the same rule. Advanced capabilities can exist in the codebase without being forced into production on day one. If your team is not ready to own AI output review, comment moderation, or newsletter operations, those features can stay off until you are.`

Feature grid

- Heading: `What stays in the core`
- Subtitle: `The core should be enough to launch and run a serious publishing site.`
- Item 1 title: `Content and structure`
- Item 1 badge: `Core`
- Item 1 description: `Posts, pages, reusable sections, taxonomy, scheduling, and SEO metadata live in one consistent model.`
- Item 2 title: `Media and delivery`
- Item 2 badge: `Core`
- Item 2 description: `Uploads, metadata, CDN-aware delivery, and editorial media workflows are built into the same admin surface.`
- Item 3 title: `Setup and operations`
- Item 3 badge: `Core`
- Item 3 description: `Hosted setup, deployment guidance, auth configuration boundaries, and migration tooling are treated as product surfaces, not afterthoughts.`

Feature grid

- Heading: `Optional feature packs`
- Subtitle: `These capabilities ship with the repo, but they should only be enabled when the workflow behind them is ready.`
- Item 1 title: `AI Suite`
- Item 1 badge: `Feature`
- Item 1 description: `Draft assistance, editorial QA, image generation, AI alt text, locale-aware narration, provider controls, and usage reporting for teams that can review output well.`
- Item 2 title: `Comments`
- Item 2 badge: `Feature`
- Item 2 description: `Public comments with moderation tooling for teams that are ready to own community response and abuse handling.`
- Item 3 title: `Newsletter`
- Item 3 badge: `Feature`
- Item 3 description: `Subscriber capture, campaign management, provider-backed delivery, and unsubscribe handling once email operations are part of the publishing workflow.`

Info blocks

- Heading: `Operating principles`
- Subtitle: `AdAstro is shaped by a few rules that keep the system from drifting into a hard-to-own platform.`
- Item 1 title: `Fail closed on sensitive paths`
- Item 1 badge: `Security`
- Item 1 description: `Setup, auth, admin actions, and privileged automation are designed to prefer a hard stop over silent risk.`
- Item 2 title: `Keep public pages lean`
- Item 2 badge: `Performance`
- Item 2 description: `The public site should stay fast because the architecture is disciplined, not because someone keeps adding rescue plugins later.`
- Item 3 title: `Let complexity arrive in phases`
- Item 3 badge: `Workflow`
- Item 3 description: `Features that require ownership, moderation, or quality review stay optional until the team has the process to support them.`

Info blocks

- Heading: `What AdAstro is not`
- Subtitle: `This matters because positioning it correctly makes the project more credible.`
- Item 1 title: `Not a hosted SaaS CMS`
- Item 1 badge: `Scope`
- Item 1 description: `AdAstro is a forkable stack you deploy and operate, not a closed platform you rent.`
- Item 2 title: `Not a plugin marketplace`
- Item 2 badge: `Product`
- Item 2 description: `The goal is a coherent codebase with feature contracts, not a growing dependency web of unrelated extensions.`
- Item 3 title: `Not pretending to be a huge enterprise suite`
- Item 3 badge: `Reality`
- Item 3 description: `The project is maintained by one developer, with AI used as leverage for implementation, documentation, and regression work. That is a strength when it stays honest about scope.`

CTA

- Heading: `Want the deeper product walkthroughs?`
- Body: `The article library covers editorial workflow, performance, AI usage, and the origin story in more detail than this page should.`
- CTA label: `Browse articles`
- CTA href: `/articles`

### Contact

Path: `/en/contact`

SEO title: `Contact AdAstro`

Meta description: `Support, bug reports, collaboration ideas, and project discussion channels for AdAstro.`

Excerpt: `Use GitHub Issues for bugs, GitHub Discussions for broader questions, and the repository for implementation details.`

Hero

- Label: `Contact`
- Heading: `Support, questions, and collaboration`
- Subheading: `AdAstro is an open-source project. The best contact route depends on whether you have found a bug, want to discuss the roadmap, or want to inspect the implementation directly.`
- Primary CTA label: `Open GitHub Issues`
- Primary CTA href: `https://github.com/burconsult/adastro/issues`
- Secondary CTA label: `GitHub Discussions`
- Secondary CTA href: `https://github.com/burconsult/adastro/discussions`

Info blocks

- Heading: `Choose the right channel`
- Subtitle: `Using the right route makes responses faster and keeps project history searchable.`
- Item 1 title: `Bug reports and reproducible problems`
- Item 1 badge: `Issues`
- Item 1 description: `Use GitHub Issues when something is broken, a release regressed, or a setup path does not behave as documented.`
- Item 2 title: `Roadmap, ideas, and implementation questions`
- Item 2 badge: `Discussions`
- Item 2 description: `Use GitHub Discussions for architecture questions, product direction, and non-bug conversations about how AdAstro should evolve.`
- Item 3 title: `Code, docs, and release details`
- Item 3 badge: `Repository`
- Item 3 description: `Use the repository when you need exact setup, environment, migration, or architecture details before making a change or evaluating the project.`

CTA

- Heading: `Start with the repository if you need the technical picture`
- Body: `README, installation notes, architecture docs, and the changelog are all maintained alongside the code so product claims and implementation details stay aligned.`
- CTA label: `View repository`
- CTA href: `https://github.com/burconsult/adastro`

### Articles Index

Path: `/en/articles`

SEO title: `AdAstro Articles`

Meta description: `Product notes, release updates, and practical guides about how AdAstro is built and how to use it.`

Excerpt: `Focused articles about publishing workflow, AI, performance, migration, and the design choices behind AdAstro.`

Hero

- Label: `Articles`
- Heading: `Notes on building and operating AdAstro`
- Subheading: `This library is for the parts that deserve more depth than a product page: editorial workflow, AI usage, performance decisions, migration tradeoffs, and the project origin story.`
- Primary CTA label: `About AdAstro`
- Primary CTA href: `/about`
- Secondary CTA label: `View repository`
- Secondary CTA href: `https://github.com/burconsult/adastro`

## Posts

### Welcome to AdAstro

Slug: `welcome-to-adastro`

SEO title: `Welcome to AdAstro`

Meta description: `An introduction to AdAstro, the Astro and Supabase publishing stack built for fast public pages, deliberate feature rollout, and practical ownership.`

Excerpt: `A quick orientation to what AdAstro is, who it is for, and where to look first if you are evaluating the stack.`

Draft

`AdAstro is a publishing stack for teams that want modern tooling without giving up control of how their site is built and operated.

At its core, AdAstro combines Astro, React, and Supabase into a CMS that is meant to stay understandable. Posts, pages, media, themes, SEO, localization, and setup all live inside one codebase. That makes it easier to reason about than a site assembled from a long chain of plugins, hosted add-ons, and dashboard-only configuration.

The project is opinionated in one important way: it assumes most teams should start lean. The base product gives you the pieces you need to launch a serious content site, including a guided setup flow, a React-powered admin workspace, fast server-rendered public routes, and a WordPress migration path. It also ships with more advanced capabilities such as AI editorial tools, comments, and newsletters, but those features stay inactive until you decide your workflow is ready for them.

That balance is the point. AdAstro is not trying to be a giant everything-on platform. It is trying to give you a strong core with clear boundaries. If you only need a fast multilingual publishing site with good SEO defaults and a clean content model, you can stop there. If you want to add AI-assisted drafting, comment moderation, or newsletter delivery later, those paths are already built into the product.

The current release also reflects a more mature product than the earliest drafts of this site suggested. Social login now includes GitHub, Google, and Microsoft through Supabase. Optional TOTP MFA can be enabled for sensitive account actions. Public routes are locale-first. The media pipeline supports manual AI alt-text generation for uploaded images and prompt-derived alt text for AI-generated images. The AI suite can assist with drafting, editorial QA, image generation, and locale-aware narration. There is even an authenticated remote MCP endpoint for tools that can safely automate publishing and admin workflows.

If you are evaluating AdAstro for your own project, there are three good places to start. First, look at the homepage and About page for the high-level positioning. Second, browse the article library for focused explanations of editorial workflow, AI usage, performance, and project history. Third, open the repository if you want the exact setup, architecture, migration, and release documentation.

AdAstro is open source and MIT licensed. It is not a hosted service. You deploy it, configure it, and own it. For some teams that will be extra work. For the right teams, it is also the reason the stack is worth using.`

### Editorial workflow with modular features switched on only when needed

Slug: `editorial-workflow-modular-features`

SEO title: `Modular editorial workflow in AdAstro`

Meta description: `How to roll out AdAstro in phases so core publishing stays simple while AI, comments, and newsletter features arrive only when the workflow is ready.`

Excerpt: `A practical rollout model for keeping AdAstro simple at launch and adding higher-leverage features only when the team can own them well.`

Draft

`One of the easiest ways to make a CMS harder to use is to enable every available feature on day one.

AdAstro is designed to avoid that trap. The product ships with a strong publishing core and several optional feature packs, but it assumes those extra capabilities should arrive in phases. That is not because AI, comments, or newsletters are unimportant. It is because each of them adds real operational work, and good software should acknowledge that upfront.

The first phase is core publishing. That means posts, pages, reusable sections, media, themes, SEO metadata, localization, and the setup flow. For many teams, that is enough to launch. It gives editors a stable workflow, keeps the admin surface easier to learn, and reduces the number of moving parts that can fail during the first weeks of a release.

The second phase is selective leverage. This is where optional features start to make sense, but only when there is clear ownership.

AI is useful when the team wants faster draft creation, better metadata suggestions, warning-style editorial QA, or narration support, but it still expects human review. If nobody owns output quality, tone, and factual correction, AI should stay off.

Comments are useful when a publication wants community interaction, but they also require moderation decisions, abuse handling, and response expectations. If moderation is not part of the workflow yet, enabling comments just creates a new liability.

Newsletter support is valuable when there is a real sending strategy behind it. Subscriber capture, campaign planning, provider setup, template quality, and unsubscribe handling all need ownership. If those pieces are not ready, the feature should wait.

The third phase is operational refinement. By this point the team understands which features it truly uses, how those workflows interact, and where the risks are. This is where settings become more deliberate, automation becomes more useful, and the boundaries between content work, moderation, delivery, and admin ownership get clearer.

This phased model is not just about keeping the UI tidy. It is about making the stack easier to own. A CMS becomes fragile when it hides process debt behind feature toggles that were flipped too early. AdAstro works better when the product state matches the maturity of the workflow behind it.

That is the real purpose of the modular design. It is not feature minimalism for its own sake. It is a way to keep editorial complexity proportional to actual need, instead of letting the platform run ahead of the team that has to operate it.`

### Why I Built This

Slug: `why-i-built-this`

SEO title: `Why I built AdAstro`

Meta description: `The story behind AdAstro: frustration with old CMS patterns, a desire to learn modern web architecture, and an experiment that turned into a serious publishing stack.`

Excerpt: `The origin story behind AdAstro, from WordPress frustration and learning goals to a real open-source CMS built with modern tools and AI assistance.`

Draft

`I have been building websites for a long time, but not from the path most people would expect.

I started in the era of static HTML, Dreamweaver, and early CMS platforms. Over time that path led through tools like Mambo, Joomla, and eventually WordPress. For years, that was enough. WordPress was practical, familiar, and flexible enough to carry a lot of projects.

But over time I became increasingly frustrated with what that flexibility usually meant in practice. Performance often depended on restraint that the platform did not naturally encourage. Complexity accumulated through plugins. Operational behavior drifted into a mix of code, dashboards, hosting quirks, and one-off fixes that made the whole system harder to reason about than it should have been.

At the same time, I wanted a serious excuse to learn how modern web architecture feels now. Not in theory, and not from a tutorial project, but through something real enough to expose tradeoffs. I wanted to work with Astro, React, Supabase, modern deployment workflows, CI, server-first rendering, and a more disciplined approach to application boundaries.

That is where AdAstro started. The question was simple: could I build a CMS from scratch that felt modern, stayed fast, and still behaved like something an actual publishing team could own?

AI changed the shape of that experiment. I am not pretending the project was built by hand in isolation. It was built with heavy AI assistance, especially for implementation speed, regression coverage, documentation, and repetitive engineering work. Used badly, that would have produced a shallow pile of code. Used well, it became a multiplier. The important part was not generating code quickly. It was learning how to steer that process hard enough that the result stayed coherent.

Some parts of the project became more serious than I originally expected. The setup flow had to become clearer. Auth and role boundaries had to fail closed. Localization needed to move from an idea to a release-ready public model. AI features had to stay reviewable instead of pretending to be autopilot. Migration tooling had to support trial runs and rollback instead of assuming every import would be clean.

That is probably the biggest difference between the original experiment and the product now. AdAstro no longer feels like a sketch. It feels like a real publishing stack with clear opinions: keep the core strong, keep public pages lean, keep advanced features optional, and document the operational boundaries as carefully as the user-facing ones.

I still would not pitch it as a universal answer for every team. It is open source, maintained by one developer, and honest about its scope. But that honesty is part of the point. AdAstro is what happened when learning modern web architecture stopped being abstract and had to survive contact with real product decisions.`

### AI tools in AdAstro: useful by default, optional by design

Recommended new slug: `adastro-ai-workflows`

Redirect from: `ai-seo-autopilot-nano-banana`

SEO title: `AI workflows in AdAstro`

Meta description: `How AdAstro uses AI for drafting, review, images, alt text, narration, and automation without turning editorial work into a black box.`

Excerpt: `AdAstro uses AI as editorial assistance, not autopilot: faster drafts, clearer review, optional narration, and human control at each important step.`

Draft

`AI in a CMS becomes dangerous when it is framed as magic.

AdAstro takes the opposite approach. The AI feature set is meant to reduce editorial friction while keeping the user in control of what actually ships. That means the product treats AI as assistance, not authority.

The most obvious example is draft support in the post editor. AdAstro can help generate suggestions for title, excerpt, slug, categories, tags, and SEO metadata, but those suggestions are explicit proposals. They are not silently applied. Editors still decide what belongs in the post, what tone fits the publication, and whether the factual framing is good enough to keep.

The same principle applies to editorial QA. The review flow is warning-oriented rather than punitive. It surfaces issues and suggestions without pretending the model can replace an editor. That matters because good publishing is not just about grammar or structure. It is about judgment.

The image workflow follows the same pattern. AI-generated featured images are available when the feature is enabled, but the result still belongs inside an editorial review process. Uploaded images can also get AI-generated alt text, and AI-generated images derive alt text from the prompt instead of falling back to generic placeholders. Both cases are practical quality-of-life improvements, but neither should remove human accountability for whether the description is actually useful.

Audio narration is where the current AI feature set becomes more interesting. AdAstro can generate locale-aware narration with configurable intro and outro templates, then expose that audio through a richer public player with seek controls and playback speed options. This turns AI into a distribution aid rather than just a drafting tool. It also shows why the feature needs settings, provider choices, and usage reporting instead of a one-button black box.

That reporting matters more than it may seem. Once a CMS offers multiple model-backed operations, teams need to understand which providers, models, and tasks are consuming usage. AdAstro has started treating that as a first-class operational concern instead of an afterthought.

There is also an automation angle. When configured, AdAstro can expose an authenticated MCP endpoint that lets compatible tools inspect publishing state and perform safe admin or content actions. This is powerful, but it only makes sense because the system keeps feature boundaries explicit and privileged actions server-side.

The through-line is simple: AI is useful when it helps editors move faster without making the system less understandable. In AdAstro, the goal is not to eliminate the human layer. The goal is to make the human layer more effective.`

### How AdAstro keeps publishing fast as content grows

Recommended new slug: `how-adastro-stays-fast`

Redirect from: `pagespeed-90-without-plugins`

SEO title: `How AdAstro stays fast as content grows`

Meta description: `A practical look at how AdAstro keeps public pages fast through Astro SSR, low JavaScript, disciplined media handling, and performance-aware publishing defaults.`

Excerpt: `AdAstro stays fast through architectural discipline: server-first rendering, low-JS public routes, careful media handling, and SEO defaults that do not depend on plugins.`

Draft

`A lot of CMS projects describe themselves as fast. Fewer can explain where that speed actually comes from.

AdAstro keeps public performance healthy by making speed part of the architecture rather than something bolted on after the site starts slowing down.

The first decision is Astro server rendering. Public pages do not need to behave like a single-page app, so they are not treated like one. Most of the site is delivered as HTML with only the JavaScript that is actually needed. That reduces client-side overhead, lowers the cost of navigation on content pages, and keeps the public experience closer to a publishing site than an application shell.

The second decision is to keep templates predictable. Performance degrades when layout behavior becomes inconsistent, when every page grows a slightly different set of client-side dependencies, or when editorial freedom depends on components that are expensive to render. AdAstro leans toward stable page structures, reusable sections, and a public surface that stays intentionally simple.

Media handling is another major part of the story. A content system gets slower over time when it quietly encourages oversized assets, poor metadata, and inconsistent delivery paths. AdAstro treats uploads, metadata, and CDN-aware delivery as part of the core media workflow, not as a late optimization pass. That keeps image handling closer to the place where editors are actually working.

SEO and performance are also tied together more tightly than many CMS stacks admit. Canonical URLs, structured metadata, sitemap generation, Open Graph output, and locale-aware routing all need to be correct, but they also need to stay maintainable. A fast site becomes fragile if its search and sharing behavior depends on a stack of extra plugins that can drift independently.

That is one reason AdAstro puts so much emphasis on owning the full path from route generation to metadata output. Locale-first URLs, localized variants, article-base-path settings, and the default public identity model all live in the same product instead of being split across separate subsystems.

The deployment model matters too. AdAstro is built to run on hosted platforms such as Vercel and Netlify, and the repo treats cache behavior, headers, build adapters, and release validation as part of the product. That is important because a site does not become fast just because its templates look clean locally. It becomes fast when the deployed behavior matches the architectural intent.

None of this means the work is ever finished. Performance is a maintenance discipline. But AdAstro is set up so the day-to-day publishing workflow does not naturally push the site in the wrong direction. That is a better starting point than relying on rescue work after content growth has already made the stack harder to control.`
