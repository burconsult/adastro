import { describe, expect, it } from 'vitest';
import {
  buildCampaignMessage,
  buildConfirmationMessage,
  buildPostMessage,
  loadNewsletterRuntimeSettings
} from '../lib/service.js';

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
    expect(message.html).toContain('profile?newsletter=');
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
