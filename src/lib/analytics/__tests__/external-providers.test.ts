import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXTERNAL_ANALYTICS_SETTINGS_STATE,
  buildExternalAnalyticsHeadHtml,
  parseExternalAnalyticsSettings,
  serializeExternalAnalyticsSettings,
  shouldRenderExternalAnalytics
} from '../external-providers';

describe('external analytics providers', () => {
  it('parses missing or invalid values to safe defaults', () => {
    expect(parseExternalAnalyticsSettings(null)).toEqual(DEFAULT_EXTERNAL_ANALYTICS_SETTINGS_STATE);
    expect(parseExternalAnalyticsSettings({ googleTag: { enabled: true, tagId: 42 } })).toEqual({
      ...DEFAULT_EXTERNAL_ANALYTICS_SETTINGS_STATE,
      googleTag: {
        enabled: true,
        tagId: ''
      }
    });
  });

  it('serializes and builds provider snippets for enabled integrations', () => {
    const settings = parseExternalAnalyticsSettings({
      googleTag: {
        enabled: true,
        tagId: 'G-TEST123'
      },
      plausible: {
        enabled: true,
        snippetHtml: '<script defer data-domain="example.com" src="https://plausible.io/js/script.js"></script>'
      },
      umami: {
        enabled: true,
        scriptUrl: 'https://cloud.umami.is/script.js',
        websiteId: '94db1cb1-74f4-4a40-ad6c-962362670409',
        hostUrl: 'https://cloud.umami.is',
        domains: 'example.com,www.example.com',
        doNotTrack: true,
        trackWebVitals: true
      },
      fathom: {
        enabled: true,
        siteId: 'ABCDE',
        honorDnt: true
      }
    });

    expect(serializeExternalAnalyticsSettings(settings)).toEqual({
      'analytics.externalProviders': settings
    });

    const html = buildExternalAnalyticsHeadHtml(settings);

    expect(html).toContain('https://www.googletagmanager.com/gtag/js?id=G-TEST123');
    expect(html).toContain("gtag('config', \"G-TEST123\")");
    expect(html).toContain('https://plausible.io/js/script.js');
    expect(html).toContain('data-website-id="94db1cb1-74f4-4a40-ad6c-962362670409"');
    expect(html).toContain('data-host-url="https://cloud.umami.is/"');
    expect(html).toContain('data-performance="true"');
    expect(html).toContain('data-site="ABCDE"');
    expect(html).toContain('data-honor-dnt="true"');
  });

  it('does not inject external analytics on excluded routes', () => {
    expect(shouldRenderExternalAnalytics('/')).toBe(true);
    expect(shouldRenderExternalAnalytics('/articles/launch')).toBe(true);
    expect(shouldRenderExternalAnalytics('/admin')).toBe(false);
    expect(shouldRenderExternalAnalytics('/api/admin/settings')).toBe(false);
    expect(shouldRenderExternalAnalytics('/mcp/tools')).toBe(false);
  });
});
