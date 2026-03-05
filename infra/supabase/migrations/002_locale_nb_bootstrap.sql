-- Migration: Norwegian Locale Bootstrap (v1.1.1)
-- Created: 2026-03-05
-- Description: Set Norwegian (`nb`) as default locale and bootstrap translated `nb` content from existing `en` records.

INSERT INTO public.site_settings (key, value, category, description)
SELECT *
FROM (
  VALUES
    (
      'content.defaultLocale',
      to_jsonb('nb'::text),
      'content',
      'Default content locale code used when a specific localized version is unavailable.'
    ),
    (
      'content.locales',
      '["nb", "en"]'::jsonb,
      'content',
      'Enabled content locales in URL prefix order (default locale first).'
    ),
    (
      'navigation.topLinks',
      '[{"label":"Hjem","href":"/"},{"label":"Artikler","href":"/articles"},{"label":"Om","href":"/about"},{"label":"Kontakt","href":"/contact"}]'::jsonb,
      'navigation',
      'Links shown in the header navigation.'
    ),
    (
      'navigation.bottomLinks',
      '[{"label":"Hjem","href":"/"},{"label":"Artikler","href":"/articles"},{"label":"Om","href":"/about"},{"label":"Kontakt","href":"/contact"}]'::jsonb,
      'navigation',
      'Links shown in the footer navigation.'
    ),
    (
      'navigation.footerAttribution',
      to_jsonb('Drevet av AdAstro'::text),
      'navigation',
      'Text shown in the footer powered-by line.'
    )
) AS default_updates(key, value, category, description)
WHERE EXISTS (SELECT 1 FROM public.posts WHERE locale = 'en')
   OR EXISTS (SELECT 1 FROM public.pages WHERE locale = 'en')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    updated_at = NOW();

INSERT INTO public.pages (
  id,
  title,
  slug,
  locale,
  status,
  template,
  content_blocks,
  content_html,
  excerpt,
  author_id,
  seo_metadata,
  published_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  CASE p.slug
    WHEN 'home' THEN 'Hjem'
    WHEN 'blog' THEN 'Artikler'
    WHEN 'about' THEN 'Om'
    WHEN 'contact' THEN 'Kontakt'
    ELSE p.title
  END,
  p.slug,
  'nb',
  p.status,
  p.template,
  p.content_blocks,
  p.content_html,
  CASE p.slug
    WHEN 'home' THEN 'Oversikt over AdAstro og produksjonsklare standarder.'
    WHEN 'blog' THEN 'Siste artikler og oppdateringer.'
    WHEN 'about' THEN 'Hva AdAstro er og hvordan du bruker det.'
    WHEN 'contact' THEN 'Hvor brukere kan kontakte vedlikeholder og bidragsytere.'
    ELSE p.excerpt
  END,
  p.author_id,
  CASE
    WHEN p.seo_metadata IS NULL THEN p.seo_metadata
    ELSE jsonb_set(
      jsonb_set(
        p.seo_metadata,
        '{metaTitle}',
        to_jsonb(
          CASE p.slug
            WHEN 'home' THEN 'AdAstro - Lynrask CMS'
            WHEN 'blog' THEN 'AdAstro Artikler'
            WHEN 'about' THEN 'Om AdAstro'
            WHEN 'contact' THEN 'Kontakt AdAstro'
            ELSE COALESCE(p.seo_metadata->>'metaTitle', p.title)
          END
        ),
        true
      ),
      '{metaDescription}',
      to_jsonb(
        CASE p.slug
          WHEN 'home' THEN 'Rask CMS med modulære funksjoner for AI, kommentarer og nyhetsbrev.'
          WHEN 'blog' THEN 'Publiseringsoppdateringer, produktnotater og praktiske CMS-guider.'
          WHEN 'about' THEN 'Et praktisk CMS med fokus på fart, kontroll og modulære funksjoner.'
          WHEN 'contact' THEN 'Support- og samarbeidskanaler for AdAstro-prosjektet.'
          ELSE COALESCE(p.seo_metadata->>'metaDescription', p.excerpt)
        END
      ),
      true
    )
  END,
  p.published_at,
  p.created_at,
  p.updated_at
FROM public.pages p
WHERE p.locale = 'en'
  AND NOT EXISTS (
    SELECT 1
    FROM public.pages nb_page
    WHERE nb_page.locale = 'nb'
      AND nb_page.slug = p.slug
  );

INSERT INTO public.page_sections (
  id,
  page_id,
  type,
  content,
  order_index,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  nb_page.id,
  ps.type,
  ps.content,
  ps.order_index,
  ps.created_at,
  ps.updated_at
FROM public.pages en_page
JOIN public.pages nb_page
  ON nb_page.slug = en_page.slug
 AND nb_page.locale = 'nb'
JOIN public.page_sections ps
  ON ps.page_id = en_page.id
WHERE en_page.locale = 'en'
  AND NOT EXISTS (
    SELECT 1
    FROM public.page_sections existing
    WHERE existing.page_id = nb_page.id
      AND existing.type = ps.type
      AND existing.order_index = ps.order_index
  );

-- Translate seeded page sections for the Norwegian locale clone.
UPDATE public.page_sections ps
SET content = '{"label":"AdAstro","heading":"AdAstro - Lynrask CMS","subheading":"Et praktisk CMS med rene standarder, høy ytelse og modulære funksjoner du kun aktiverer ved behov.","primaryCtaLabel":"Les artikler","primaryCtaHref":"/blog","secondaryCtaLabel":"Åpne admin","secondaryCtaHref":"/admin","imageUrl":"/images/adastro.webp","imageAlt":"AdAstro lanseringsillustrasjon"}'::jsonb
FROM public.pages p
WHERE ps.page_id = p.id
  AND p.locale = 'nb'
  AND p.slug = 'home'
  AND ps.type = 'hero'
  AND ps.order_index = 0;

UPDATE public.page_sections ps
SET content = '{"heading":"Hva som følger med i kjernen","subtitle":"Lette standarder for raske nettsider og enkel publisering.","items":[{"badge":"Ytelse","title":"Rask som standard","description":"Minimal JavaScript, optimalisert rendering og forutsigbare maler."},{"badge":"Sikkerhet","title":"Supabase-først autentisering","description":"Serverbeskyttede adminruter og sikker oppsettflyt som standard."},{"badge":"Modulært","title":"Valgfrie funksjoner","description":"AI, kommentarer og nyhetsbrev er med i pakken, men inaktive til du slår dem på."}]}'::jsonb
FROM public.pages p
WHERE ps.page_id = p.id
  AND p.locale = 'nb'
  AND p.slug = 'home'
  AND ps.type = 'feature_grid'
  AND ps.order_index = 1;

UPDATE public.page_sections ps
SET content = '{"heading":"Klar for publisering","body":"Bruk Artikler-siden for innhold, og hold forsiden fokusert på produktbudskapet.","ctaLabel":"Gå til artikler","ctaHref":"/blog"}'::jsonb
FROM public.pages p
WHERE ps.page_id = p.id
  AND p.locale = 'nb'
  AND p.slug = 'home'
  AND ps.type = 'cta'
  AND ps.order_index = 2;

UPDATE public.page_sections ps
SET content = '{"label":"Innhold","heading":"Artikler","subheading":"Publiseringsoppdateringer, praktiske guider og lanseringsnotater.","primaryCtaLabel":"Kontakt oss","primaryCtaHref":"/contact"}'::jsonb
FROM public.pages p
WHERE ps.page_id = p.id
  AND p.locale = 'nb'
  AND p.slug = 'blog'
  AND ps.type = 'hero'
  AND ps.order_index = 0;

UPDATE public.page_sections ps
SET content = '{"label":"Om","heading":"Bygget for å holde seg rask over tid","subheading":"AdAstro startet som en praktisk respons på trege, plugin-tunge CMS-stabler. Målet er enkelt: hold publisering forutsigbar, rask og vedlikeholdbar.","imageUrl":"/images/adastro.webp","imageAlt":"AdAstro prosjektillustrasjon"}'::jsonb
FROM public.pages p
WHERE ps.page_id = p.id
  AND p.locale = 'nb'
  AND p.slug = 'about'
  AND ps.type = 'hero'
  AND ps.order_index = 0;

UPDATE public.page_sections ps
SET content = '{"heading":"Slik jobber du med AdAstro","subtitle":"Lanseringsløpet er bevisst enkelt og bygget for trinnvis innføring.","items":[{"title":"Start med kjernen","description":"Kjør kjerne-SQL, fullfør oppsettet og verifiser offentlige ruter og menyer."},{"title":"Skru på funksjoner bevisst","description":"Aktiver AI, kommentarer og nyhetsbrev først når prosess og moderering er klare."},{"title":"Lever uten plugin-spredning","description":"De fleste produksjonsoppsett kan holde seg lette og fortsatt nå høy ytelse."}]}'::jsonb
FROM public.pages p
WHERE ps.page_id = p.id
  AND p.locale = 'nb'
  AND p.slug = 'about'
  AND ps.type = 'info_blocks'
  AND ps.order_index = 1;

UPDATE public.page_sections ps
SET content = '{"heading":"Hva som er inkludert","subtitle":"Alt her kan redigeres fra admin-UI.","items":[{"badge":"Kjerne","title":"Sider, innlegg, media, brukere","description":"En komplett publiseringskjerne med oppsettflyt, temaer og sikker admin-tilgang."},{"badge":"Ytelse","title":"PageSpeed-først standarder","description":"Lette maler, redusert klient-JS og en forutsigbar renderingsmodell."},{"badge":"Modulært","title":"Valgfrie funksjonspakker","description":"AI, kommentarer og nyhetsbrev er med i kjernen, men inaktive til de aktiveres."}]}'::jsonb
FROM public.pages p
WHERE ps.page_id = p.id
  AND p.locale = 'nb'
  AND p.slug = 'about'
  AND ps.type = 'feature_grid'
  AND ps.order_index = 2;

UPDATE public.page_sections ps
SET content = '{"heading":"Vil du tilpasse videre?","body":"Bruk sideeditor, temabehandler og funksjonsrammeverket for å tilpasse AdAstro til egen publiseringsflyt.","ctaLabel":"Åpne dokumentasjon","ctaHref":"https://github.com/burconsult/adastro"}'::jsonb
FROM public.pages p
WHERE ps.page_id = p.id
  AND p.locale = 'nb'
  AND p.slug = 'about'
  AND ps.type = 'cta'
  AND ps.order_index = 3;

UPDATE public.page_sections ps
SET content = '{"label":"Kontakt","heading":"Spørsmål eller samarbeidsidéer","subheading":"Bruk denne siden for supportlenker, tilbakemelding på veikart og henvendelser fra bidragsytere.","primaryCtaLabel":"Åpne GitHub Issues","primaryCtaHref":"https://github.com/burconsult/adastro/issues","secondaryCtaLabel":"Diskusjoner","secondaryCtaHref":"https://github.com/burconsult/adastro/discussions","imageUrl":"/images/adastro.webp","imageAlt":"Illustrasjon av supportdesk"}'::jsonb
FROM public.pages p
WHERE ps.page_id = p.id
  AND p.locale = 'nb'
  AND p.slug = 'contact'
  AND ps.type = 'hero'
  AND ps.order_index = 0;

UPDATE public.page_sections ps
SET content = '{"heading":"Oppdater denne siden fra editoren","body":"Alt her kan redigeres fra Admin -> Sider uten kodeendringer.","ctaLabel":"Åpne sider","ctaHref":"/admin/pages"}'::jsonb
FROM public.pages p
WHERE ps.page_id = p.id
  AND p.locale = 'nb'
  AND p.slug = 'contact'
  AND ps.type = 'cta'
  AND ps.order_index = 1;

INSERT INTO public.posts (
  id,
  title,
  slug,
  locale,
  content,
  blocks,
  excerpt,
  author_id,
  featured_image_id,
  status,
  published_at,
  created_at,
  updated_at,
  seo_metadata,
  custom_fields,
  audio_asset_id
)
SELECT
  gen_random_uuid(),
  CASE p.slug
    WHEN 'pagespeed-90-without-plugins' THEN 'Slik holder AdAstro publiseringen rask når innholdet vokser'
    WHEN 'ai-seo-autopilot-nano-banana' THEN 'AI-verktøy i AdAstro: nyttig som standard, valgfritt av design'
    WHEN 'release-checklist-clean-launch' THEN 'Lanseringssjekkliste: hold første lansering ryddig og rolig'
    WHEN 'editorial-workflow-modular-features' THEN 'Redaksjonell flyt med modulære funksjoner kun ved behov'
    WHEN 'prototype-to-production-setup' THEN 'Fra prototype til produksjon: hva som endret seg i AdAstro-oppsettet'
    ELSE p.title
  END,
  p.slug,
  'nb',
  CASE p.slug
    WHEN 'pagespeed-90-without-plugins' THEN '<h2>Rask som standard, ikke tilfeldig</h2><p>AdAstro holder løsningen lett med server-først rendering, forutsigbare maler og minimal klient-JavaScript.</p><h2>Det viktigste</h2><ul><li>Stabile layout-primitiver som beskytter CLS</li><li>Medieflyt som unngår unødvendig store opplastinger</li><li>Enkle SEO-standarder uten plugin-overbygg</li></ul><h2>Praktisk arbeidsflyt</h2><p>Team kan publisere daglig uten at ytelsen gradvis forverres.</p>'
    WHEN 'ai-seo-autopilot-nano-banana' THEN '<h2>AI skal redusere friksjon, ikke fjerne kontroll</h2><p>Den innebygde AI-funksjonen kan lage utkast til metadata og innholdshjelp, men alt kan kvalitetssikres før publisering.</p><h2>Anbefalt flyt</h2><ol><li>Bruk AI til førsteutkast.</li><li>Rediger tone og fakta.</li><li>Publiser først etter menneskelig gjennomgang.</li></ol><p>Dette gir konsistent kvalitet uten å gjøre CMS-et til en svart boks.</p>'
    WHEN 'release-checklist-clean-launch' THEN '<h2>Før lanseringsdagen</h2><p>Bekreft kjerne-ruter, test autentisering og hold funksjonsflagg bevisste.</p><h2>Hva du bør verifisere</h2><ul><li>Kjernesider og menyer vises som forventet</li><li>Funksjonsmoduler forblir inaktive til de aktiveres</li><li>Media og SEO-metadata oppfører seg forutsigbart</li></ul><p>En rolig lansering er som regel resultatet av en liten, repeterbar sjekkliste.</p>'
    WHEN 'editorial-workflow-modular-features' THEN '<h2>Start med kjernen</h2><p>Begynn med lett publisering og aktiver ekstra funksjoner kun ved tydelige behov.</p><h2>Anbefalt utrulling</h2><ol><li>Publiser med kjerne og standardtema.</li><li>Aktiver kommentarer når modereringsregler er klare.</li><li>Aktiver nyhetsbrev når leverandør og maler er konfigurert.</li></ol><p>Dette holder kompleksiteten proporsjonal med redaksjonens faktiske behov.</p>'
    WHEN 'prototype-to-production-setup' THEN '<h2>Oppsettflyten er viktig</h2><p>Produksjonsoppsettet prioriterer nå klare forutsetninger, automatiske kontroller og færre skjulte antakelser.</p><h2>Viktige forbedringer</h2><ul><li>Strengere oppsett-gating</li><li>Bedre validering av miljøvariabler</li><li>Bedre standarder for innhold og navigasjon</li></ul><p>Små forbedringer i robusthet gir stor effekt når innholdsvolumet øker.</p>'
    ELSE p.content
  END,
  p.blocks,
  CASE p.slug
    WHEN 'pagespeed-90-without-plugins' THEN 'En praktisk gjennomgang av publiseringsstandardene som holder AdAstro rask uten tunge plugin-stakker.'
    WHEN 'ai-seo-autopilot-nano-banana' THEN 'En realistisk AI-flyt for redaktører: valgfri automatisering, tydelig kvalitetssikring og forutsigbare resultater.'
    WHEN 'release-checklist-clean-launch' THEN 'En praktisk sjekkliste før lansering for å holde installasjoner forutsigbare og produksjonsklare.'
    WHEN 'editorial-workflow-modular-features' THEN 'Hvordan rulle ut kommentarer, AI-hjelpere og nyhetsbrev uten å overkomplisere dag én.'
    WHEN 'prototype-to-production-setup' THEN 'Hva som endret seg fra tidlig bygg til produksjonsklart oppsett, og hvorfor det betyr noe.'
    ELSE p.excerpt
  END,
  p.author_id,
  p.featured_image_id,
  p.status,
  p.published_at,
  p.created_at,
  p.updated_at,
  CASE
    WHEN p.seo_metadata IS NULL THEN p.seo_metadata
    ELSE jsonb_set(
      jsonb_set(
        p.seo_metadata,
        '{metaTitle}',
        to_jsonb(
          CASE p.slug
            WHEN 'pagespeed-90-without-plugins' THEN 'Slik holder AdAstro seg rask i skala'
            WHEN 'ai-seo-autopilot-nano-banana' THEN 'Valgfrie AI-flyter i AdAstro'
            WHEN 'release-checklist-clean-launch' THEN 'AdAstro lanseringssjekkliste'
            WHEN 'editorial-workflow-modular-features' THEN 'Modulær redaksjonell arbeidsflyt'
            WHEN 'prototype-to-production-setup' THEN 'AdAstro-oppsett fra prototype til produksjon'
            ELSE COALESCE(p.seo_metadata->>'metaTitle', p.title)
          END
        ),
        true
      ),
      '{metaDescription}',
      to_jsonb(
        CASE p.slug
          WHEN 'pagespeed-90-without-plugins' THEN 'Se hvordan AdAstro holder sterke Core Web Vitals med praktiske publiseringsstandarder.'
          WHEN 'ai-seo-autopilot-nano-banana' THEN 'Bruk AdAstro AI-funksjoner til utkast og metadata med full redaksjonell kontroll.'
          WHEN 'release-checklist-clean-launch' THEN 'Bruk denne lette sjekklisten for å validere ruter, auth og modulære funksjonstilstander før lansering.'
          WHEN 'editorial-workflow-modular-features' THEN 'En trinnvis metode for å aktivere AdAstro-funksjoner uten å miste en lett kjerneopplevelse.'
          WHEN 'prototype-to-production-setup' THEN 'En gjennomgang av oppsett- og robusthetsforbedringer som gjorde AdAstro produksjonsklart.'
          ELSE COALESCE(p.seo_metadata->>'metaDescription', p.excerpt)
        END
      ),
      true
    )
  END,
  p.custom_fields,
  p.audio_asset_id
FROM public.posts p
WHERE p.locale = 'en'
  AND NOT EXISTS (
    SELECT 1
    FROM public.posts nb_post
    WHERE nb_post.locale = 'nb'
      AND nb_post.slug = p.slug
  );

INSERT INTO public.post_categories (post_id, category_id)
SELECT nb_post.id, pc.category_id
FROM public.posts en_post
JOIN public.posts nb_post
  ON nb_post.slug = en_post.slug
 AND nb_post.locale = 'nb'
JOIN public.post_categories pc
  ON pc.post_id = en_post.id
WHERE en_post.locale = 'en'
ON CONFLICT DO NOTHING;

INSERT INTO public.post_tags (post_id, tag_id)
SELECT nb_post.id, pt.tag_id
FROM public.posts en_post
JOIN public.posts nb_post
  ON nb_post.slug = en_post.slug
 AND nb_post.locale = 'nb'
JOIN public.post_tags pt
  ON pt.post_id = en_post.id
WHERE en_post.locale = 'en'
ON CONFLICT DO NOTHING;
