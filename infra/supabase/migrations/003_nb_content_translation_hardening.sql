-- Migration: Norwegian Content Translation Hardening (v1.1.2)
-- Created: 2026-03-05
-- Description: Backfill known untranslated Norwegian about-page sections for existing installs.

UPDATE public.page_sections ps
SET content = '{"heading":"Hva som er inkludert","subtitle":"Alt her kan redigeres fra admin-UI.","items":[{"badge":"Kjerne","title":"Sider, innlegg, media, brukere","description":"En komplett publiseringskjerne med oppsettflyt, temaer og sikker admin-tilgang."},{"badge":"Ytelse","title":"PageSpeed-først standarder","description":"Lette maler, redusert klient-JS og en forutsigbar renderingsmodell."},{"badge":"Modulært","title":"Valgfrie funksjonspakker","description":"AI, kommentarer og nyhetsbrev er med i kjernen, men inaktive til de aktiveres."}]}'::jsonb,
    updated_at = NOW()
FROM public.pages p
WHERE ps.page_id = p.id
  AND p.locale = 'nb'
  AND p.slug = 'about'
  AND ps.type = 'feature_grid'
  AND (
    ps.content->>'heading' = 'What is included'
    OR ps.content->>'heading' = 'Hva som er inkludert'
  );

UPDATE public.page_sections ps
SET content = '{"heading":"Slik jobber du med AdAstro","subtitle":"Lanseringsløpet er bevisst enkelt og bygget for trinnvis innføring.","items":[{"title":"Start med kjernen","description":"Kjør kjerne-SQL, fullfør oppsettet og verifiser offentlige ruter og menyer."},{"title":"Skru på funksjoner bevisst","description":"Aktiver AI, kommentarer og nyhetsbrev først når prosess og moderering er klare."},{"title":"Lever uten plugin-spredning","description":"De fleste produksjonsoppsett kan holde seg lette og fortsatt nå høy ytelse."}]}'::jsonb,
    updated_at = NOW()
FROM public.pages p
WHERE ps.page_id = p.id
  AND p.locale = 'nb'
  AND p.slug = 'about'
  AND ps.type = 'info_blocks'
  AND (
    ps.content->>'heading' = 'How to work with AdAstro'
    OR ps.content->>'heading' = 'Slik jobber du med AdAstro'
  );

UPDATE public.page_sections ps
SET content = '{"heading":"Musikkvideo jeg laget","sourceType":"embed","sourceUrl":"https://www.youtube.com/watch?v=SLNkd6_bENc","posterUrl":"","caption":""}'::jsonb,
    updated_at = NOW()
FROM public.pages p
WHERE ps.page_id = p.id
  AND p.locale = 'nb'
  AND p.slug = 'about'
  AND ps.type = 'video'
  AND (
    ps.content->>'heading' = 'Fun music video I made'
    OR ps.content->>'heading' = 'Musikkvideo jeg laget'
  );
