import { describe, expect, it } from 'vitest';
import {
  LEGACY_NEWSLETTER_DEFAULT_CAMPAIGN_HTML,
  buildCampaignMessage,
  buildConfirmationMessage,
  buildNewsletterOneClickHeaders,
  buildNewsletterUnsubscribeToken,
  buildPostMessage,
  readNewsletterUnsubscribeToken,
  loadNewsletterRuntimeSettings
} from '../lib/service.js';

process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || 'test-supabase-secret';

describe('newsletter service', () => {
  it('maps runtime settings including ses provider and compliance fields', async () => {
    const settings = await loadNewsletterRuntimeSettings({
      getSettings: async () => ({
        'features.newsletter.enabled': true,
        'features.newsletter.provider': 'ses',
        'features.newsletter.fromName': 'AdAstro',
        'features.newsletter.fromEmail': 'news@example.com',
        'features.newsletter.replyTo': 'reply@example.com',
        'features.newsletter.sendWelcomeEmail': true,
        'features.newsletter.requireDoubleOptIn': true,
        'features.newsletter.requireConsentCheckbox': true,
        'features.newsletter.consentLabel': 'Consent copy',
        'features.newsletter.complianceFooterHtml': '<p>Footer {{unsubscribeUrl}}</p>',
        'features.newsletter.maxRecipientsPerCampaign': 500,
        'features.newsletter.templates.subscriptionSubject': 'Welcome {{siteTitle}}',
        'features.newsletter.templates.subscriptionHtml': '<p>Welcome</p>',
        'features.newsletter.templates.confirmationSubject': 'Confirm {{siteTitle}}',
        'features.newsletter.templates.confirmationHtml': '<p><a href="{{confirmUrl}}">Confirm</a></p>',
        'features.newsletter.templates.newPostSubject': 'New {{postTitle}}',
        'features.newsletter.templates.newPostHtml': '<p>{{postTitle}}</p><p>{{postUrl}}</p>',
        'features.newsletter.templates.campaignSubject': '{{siteTitle}} digest',
        'features.newsletter.templates.campaignHtml': '<div>{{introHtml}}{{articleCardsHtml}}</div>',
        'site.title': 'AdAstro',
        'site.url': 'https://adastrocms.vercel.app'
      })
    } as any);

    expect(settings.provider).toBe('ses');
    expect(settings.requireDoubleOptIn).toBe(true);
    expect(settings.requireConsentCheckbox).toBe(true);
    expect(settings.siteUrl).toBe('https://adastrocms.vercel.app');
  });

  it('normalizes the configured site url to the canonical production host', async () => {
    const settings = await loadNewsletterRuntimeSettings({
      getSettings: async () => ({
        'site.title': 'AdAstro',
        'site.url': 'https://adastro.no/'
      })
    } as any);

    expect(settings.siteUrl).toBe('https://www.adastro.no');
  });

  it('builds confirmation message with confirmation url token', () => {
    const settings: any = {
      siteTitle: 'AdAstro',
      siteUrl: 'https://adastrocms.vercel.app',
      complianceFooterHtml: '<p>Unsubscribe: {{unsubscribeUrl}}</p>',
      templates: {
        confirmationSubject: 'Confirm {{siteTitle}}',
        confirmationHtml: '<p><a href="{{confirmUrl}}">Confirm now</a></p>'
      }
    };

    const message = buildConfirmationMessage(settings, 'reader@example.com', 'token-123');
    expect(message.subject).toContain('Confirm AdAstro');
    expect(message.html).toContain('token-123');
    expect(message.html).toContain('/api/features/newsletter/confirm');
    expect(message.html).toContain('/api/features/newsletter/unsubscribe?token=');
  });

  it('round-trips signed unsubscribe tokens', () => {
    const token = buildNewsletterUnsubscribeToken('reader@example.com', 60_000);
    const payload = readNewsletterUnsubscribeToken(token);

    expect(payload?.email).toBe('reader@example.com');
    expect(payload?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('builds one-click unsubscribe headers for compliant delivery', () => {
    const settings: any = {
      siteTitle: 'AdAstro',
      siteUrl: 'https://www.adastro.no',
      fromEmail: 'newsletter@adastro.no'
    };

    const headers = buildNewsletterOneClickHeaders(settings, 'reader@example.com');

    expect(headers.headers['List-Unsubscribe']).toContain('/api/features/newsletter/unsubscribe?token=');
    expect(headers.headers['List-Unsubscribe']).toContain('mailto:newsletter@adastro.no?subject=unsubscribe');
    expect(headers.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(headers.headers['List-ID']).toContain('newsletter.adastro.no');
  });

  it('reuses one unsubscribe context across the body and one-click headers', () => {
    const settings: any = {
      siteTitle: 'AdAstro',
      siteUrl: 'https://www.adastro.no',
      fromEmail: 'newsletter@adastro.no',
      complianceFooterHtml: '<p>Unsubscribe: <a href="{{unsubscribeUrl}}">Unsubscribe</a></p>',
      templates: {
        campaignSubject: '{{siteTitle}} update',
        campaignHtml: '<section>{{articleCardsHtml}}</section>'
      }
    };

    const message = buildCampaignMessage(settings, 'reader@example.com', {
      articles: []
    });
    const headers = buildNewsletterOneClickHeaders(settings, 'reader@example.com', message.unsubscribeContext);

    expect(message.html).toContain(message.unsubscribeContext.unsubscribeUrl);
    expect(headers.unsubscribeUrl).toBe(message.unsubscribeContext.unsubscribeUrl);
    expect(headers.headers['List-Unsubscribe']).toContain(message.unsubscribeContext.unsubscribeUrl);
  });

  it('skips the compliance footer when the rendered body already includes the unsubscribe url', () => {
    const settings: any = {
      siteTitle: 'AdAstro',
      siteUrl: 'https://www.adastro.no',
      fromEmail: 'newsletter@adastro.no',
      complianceFooterHtml: '<p>You are receiving this email from {{siteTitle}}. <a href="{{unsubscribeUrl}}">Unsubscribe</a></p>',
      templates: {
        campaignSubject: '{{siteTitle}} update',
        campaignHtml: '<section><p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>{{articleCardsHtml}}</section>'
      }
    };

    const message = buildCampaignMessage(settings, 'reader@example.com', {
      articles: []
    });

    expect(message.html).toContain('<p><a href="https://www.adastro.no/api/features/newsletter/unsubscribe?token=');
    expect(message.html).not.toContain('You are receiving this email from AdAstro');
  });

  it('normalizes the legacy campaign template so only the compliance footer renders the unsubscribe link', async () => {
    const settings = await loadNewsletterRuntimeSettings({
      getSettings: async () => ({
        'site.title': 'AdAstro',
        'site.url': 'https://www.adastro.no',
        'features.newsletter.fromEmail': 'newsletter@adastro.no',
        'features.newsletter.complianceFooterHtml': '<p>Footer <a href="{{unsubscribeUrl}}">Unsubscribe</a></p>',
        'features.newsletter.templates.campaignHtml': LEGACY_NEWSLETTER_DEFAULT_CAMPAIGN_HTML
      })
    } as any);

    const message = buildCampaignMessage(settings, 'reader@example.com', {
      articles: []
    });

    expect(settings.templates.campaignHtml).toBe('<div><p>{{introHtml}}</p>{{articleCardsHtml}}</div>');
    expect(message.html).toContain('Footer');
    expect(
      message.html.match(/href="https:\/\/www\.adastro\.no\/api\/features\/newsletter\/unsubscribe\?token=[^"]+"/g)
    ).toHaveLength(1);
  });

  it('builds campaign message with selected article cards', () => {
    const settings: any = {
      siteTitle: 'AdAstro',
      siteUrl: 'https://adastrocms.vercel.app',
      complianceFooterHtml: '<p>Unsubscribe: {{unsubscribeUrl}}</p>',
      templates: {
        campaignSubject: '{{siteTitle}} update',
        campaignHtml: '<section>{{introHtml}}{{articleCardsHtml}}</section>'
      }
    };

    const message = buildCampaignMessage(settings, 'reader@example.com', {
      subject: '',
      introHtml: '<p>Weekly highlights</p>',
      articles: [
        {
          title: 'How We Hit 95 PSI',
          excerpt: 'Performance tuning checklist',
          url: 'https://adastrocms.vercel.app/blog/how-we-hit-95-psi'
        }
      ]
    });

    expect(message.subject).toContain('AdAstro update');
    expect(message.html).toContain('Weekly highlights');
    expect(message.html).toContain('How We Hit 95 PSI');
    expect(message.html).toContain('Read article');
    expect(message.html).toContain('Unsubscribe');
  });

  it('escapes untrusted fields in post messages', () => {
    const settings: any = {
      siteTitle: 'AdAstro',
      siteUrl: 'https://adastrocms.vercel.app',
      complianceFooterHtml: '<p>Unsubscribe: {{unsubscribeUrl}}</p>',
      templates: {
        newPostSubject: 'New {{postTitle}}',
        newPostHtml: '<p>{{postTitle}}</p><p>{{postExcerpt}}</p><p>{{postUrl}}</p>'
      }
    };

    const message = buildPostMessage(settings, 'reader@example.com', {
      title: '<script>alert(1)</script>',
      excerpt: '<img src=x onerror=alert(1)>hello',
      url: 'javascript:alert(1)'
    });

    expect(message.subject).not.toContain('<script>');
    expect(message.html).not.toContain('<img');
    expect(message.html).toContain('&lt;img');
    expect(message.html).not.toContain('javascript:');
    expect(message.html).toContain('#');
  });
});
